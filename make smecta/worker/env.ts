import type { AdminSecurityCoordinator } from './security/security-coordinators';

// The public bindings are generated from wrangler.json. Admin-only bindings are
// present only on the separately deployed admin Worker.
export type Env = Cloudflare.Env & {
  ADMIN_ACCESS_EMAIL: string;
  ADMIN_ACCESS_AUD?: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_PASSWORD_PEPPER: string;
  ADMIN_SECURITY: DurableObjectNamespace<AdminSecurityCoordinator>;
};

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
