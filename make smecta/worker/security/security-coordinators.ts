import { DurableObject } from 'cloudflare:workers';
import type { AdminIdentity } from '../auth/auth-api';
import type { Env } from '../env';

const ATTEMPT_WINDOW_SECONDS = 10 * 60;
const ACCOUNT_FAILURE_LIMIT = 8;
const IP_FAILURE_LIMIT = 5;
const LOCK_DURATIONS_SECONDS = [15 * 60, 60 * 60, 6 * 60 * 60, 24 * 60 * 60] as const;
const VALID_ROLES = new Set<AdminIdentity['role']>(['superadmin', 'admin', 'owner', 'editor', 'analyst']);

interface AttemptState extends Record<string, SqlStorageValue> {
  scope: string;
  failures: number;
  window_started_at: number;
  lock_until: number;
  lock_level: number;
}

export interface LoginPermit {
  allowed: boolean;
  retryAfter: number;
}

export interface StoredAdminSession extends AdminIdentity {
  expiresAt: number;
}

function lockDuration(level: number): number {
  return LOCK_DURATIONS_SECONDS[Math.min(level, LOCK_DURATIONS_SECONDS.length - 1)];
}

/**
 * Single, globally addressable coordinator for the password-only administrator.
 * Every incorrect password is durably counted, preventing concurrent or
 * cross-colo wrong guesses from bypassing account/IP throttling.
 */
export class AdminSecurityCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS attempt_states (
        scope TEXT PRIMARY KEY,
        failures INTEGER NOT NULL,
        window_started_at INTEGER NOT NULL,
        lock_until INTEGER NOT NULL,
        lock_level INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        role TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
    `);
  }

  private state(scope: string, now: number): AttemptState {
    const row = this.ctx.storage.sql.exec<AttemptState>(
      `SELECT scope, failures, window_started_at, lock_until, lock_level
       FROM attempt_states WHERE scope = ?1 LIMIT 1`,
      scope,
    ).toArray()[0];
    if (!row) return { scope, failures: 0, window_started_at: now, lock_until: 0, lock_level: 0 };
    if (row.lock_until <= now && now - row.window_started_at >= ATTEMPT_WINDOW_SECONDS) {
      return { ...row, failures: 0, window_started_at: now, lock_until: 0 };
    }
    return row;
  }

  private reserve(state: AttemptState, threshold: number, now: number): AttemptState {
    const failures = state.failures + 1;
    const locksNow = failures >= threshold;
    const lockLevel = locksNow ? state.lock_level + 1 : state.lock_level;
    const lockUntil = locksNow ? now + lockDuration(state.lock_level) : state.lock_until;
    const updated = { ...state, failures, lock_until: lockUntil, lock_level: lockLevel };
    this.ctx.storage.sql.exec(
      `INSERT INTO attempt_states(scope, failures, window_started_at, lock_until, lock_level)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(scope) DO UPDATE SET
         failures = excluded.failures,
         window_started_at = excluded.window_started_at,
         lock_until = excluded.lock_until,
         lock_level = excluded.lock_level`,
      updated.scope,
      updated.failures,
      updated.window_started_at,
      updated.lock_until,
      updated.lock_level,
    );
    return updated;
  }

  async beginLogin(ipHash: string, now: number): Promise<LoginPermit> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ipHash) || !Number.isSafeInteger(now)) {
      throw new Error('invalid_login_attempt');
    }
    return this.ctx.storage.transactionSync(() => {
      const account = this.state('account:master', now);
      const ip = this.state(`ip:${ipHash}`, now);
      const retryAfter = Math.max(account.lock_until - now, ip.lock_until - now, 0);
      if (retryAfter > 0) return { allowed: false, retryAfter };

      this.reserve(account, ACCOUNT_FAILURE_LIMIT, now);
      this.reserve(ip, IP_FAILURE_LIMIT, now);
      return { allowed: true, retryAfter: 0 };
    });
  }

  async completeLogin(
    ipHash: string,
    success: boolean,
    tokenHash: string | null,
    identity: AdminIdentity | null,
    expiresAt: number | null,
    now: number,
  ): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ipHash) || !Number.isSafeInteger(now)) {
      throw new Error('invalid_login_completion');
    }
    if (!success) return;
    if (!tokenHash || !/^[A-Za-z0-9_-]{43}$/.test(tokenHash) || !identity
      || !VALID_ROLES.has(identity.role) || !Number.isSafeInteger(expiresAt) || expiresAt! <= now) {
      throw new Error('invalid_login_completion');
    }
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `DELETE FROM attempt_states WHERE scope IN ('account:master', ?1)`,
        `ip:${ipHash}`,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO admin_sessions(token_hash, admin_id, role, expires_at, revoked_at)
         VALUES (?1, ?2, ?3, ?4, NULL)`,
        tokenHash,
        identity.id,
        identity.role,
        expiresAt,
      );
      this.ctx.storage.sql.exec('DELETE FROM admin_sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL', now);
    });
  }

  async validateSession(tokenHash: string, now: number): Promise<StoredAdminSession | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(tokenHash) || !Number.isSafeInteger(now)) return null;
    const row = this.ctx.storage.sql.exec<{
      admin_id: string;
      role: string;
      expires_at: number;
    }>(
      `SELECT admin_id, role, expires_at FROM admin_sessions
       WHERE token_hash = ?1 AND revoked_at IS NULL AND expires_at > ?2 LIMIT 1`,
      tokenHash,
      now,
    ).toArray()[0];
    if (!row || !VALID_ROLES.has(row.role as AdminIdentity['role'])) return null;
    return { id: row.admin_id, role: row.role as AdminIdentity['role'], expiresAt: row.expires_at };
  }

  async revokeSession(tokenHash: string, now: number): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(tokenHash) || !Number.isSafeInteger(now)) return;
    this.ctx.storage.sql.exec(
      'UPDATE admin_sessions SET revoked_at = ?1 WHERE token_hash = ?2 AND revoked_at IS NULL',
      now,
      tokenHash,
    );
  }

  async revokeAllSessions(now: number): Promise<void> {
    if (!Number.isSafeInteger(now)) throw new Error('invalid_revocation_time');
    this.ctx.storage.sql.exec('UPDATE admin_sessions SET revoked_at = ?1 WHERE revoked_at IS NULL', now);
  }
}

export interface AtomicRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/** Per-policy, per-actor global fixed-window limiter backed by SQLite. */
export class AtomicRateLimiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_events (
        occurred_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rate_events_time_idx ON rate_events(occurred_at);
    `);
  }

  async check(limit: number, windowSeconds: number, now: number): Promise<AtomicRateLimitResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000
      || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86_400
      || !Number.isSafeInteger(now)) throw new Error('invalid_rate_limit');
    return this.ctx.storage.transactionSync(() => {
      const cutoff = now - windowSeconds;
      this.ctx.storage.sql.exec('DELETE FROM rate_events WHERE occurred_at <= ?1', cutoff);
      const rows = this.ctx.storage.sql.exec<{ occurred_at: number }>(
        'SELECT occurred_at FROM rate_events ORDER BY occurred_at ASC',
      ).toArray();
      if (rows.length >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(1, rows[0].occurred_at + windowSeconds - now),
        };
      }
      this.ctx.storage.sql.exec('INSERT INTO rate_events(occurred_at) VALUES (?1)', now);
      return { allowed: true, remaining: limit - rows.length - 1, retryAfter: 0 };
    });
  }
}
