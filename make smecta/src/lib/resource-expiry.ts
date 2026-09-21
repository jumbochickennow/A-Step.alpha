// A closing date stays visible through that day in Algeria (UTC+1, no DST).
export function resourceExpiry(deadline: string | null): number {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return 0;
  const midnight = Date.parse(`${deadline}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== deadline) return 0;
  return midnight + 23 * 60 * 60 * 1000;
}

export function resourceIsActive(item: { published: boolean; deadline: string | null }, now = Date.now()): boolean {
  return item.published && resourceExpiry(item.deadline) > now;
}
