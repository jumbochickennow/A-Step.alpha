import { useEffect, useState } from 'react';
import type { Opportunity } from '../types/content';
import { apiJson } from '../services/api-client';
import { resourceExpiry, resourceIsActive } from '../lib/resource-expiry';

export function useResources() {
  const [catalog, setCatalog] = useState<{ items: Opportunity[]; offset: number }>({ items: [], offset: 0 });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const result = await apiJson<{ items: Opportunity[]; now: number }>('/api/v1/resources', { signal: controller.signal });
        if (!Array.isArray(result.items) || !Number.isFinite(result.now)) throw new Error('Invalid catalog');
        if (active) { setCatalog({ items: result.items, offset: result.now - Date.now() }); setNow(result.now); }
      } catch {
        // Fail closed: never revive mockups or stale records after an API failure.
        if (active) setCatalog({ items: [], offset: 0 });
      } finally { clearTimeout(timeout); pending = false; if (active) setLoading(false); }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; controller?.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now() + catalog.offset);
    const next = Math.min(...catalog.items.map(item => resourceExpiry(item.deadline)).filter(time => time > now));
    const timer = setTimeout(tick, Math.max(1, Math.min(60_000, next - now)));
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [catalog, now]);
  return { items: catalog.items.filter(item => resourceIsActive(item, now)), loading };
}
