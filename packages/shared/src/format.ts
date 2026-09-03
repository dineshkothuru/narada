export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

// ponytail: display-only 8-char UUID prefix can collide; add a persisted
// per-outlet sequence if collision or operational requirements demand it.
export const orderToken = (id: string) => id.slice(0, 8).toUpperCase();

export function minutesAgo(iso: string, compact = false): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (compact) return mins === 0 ? "now" : `${mins}m`;
  return mins === 0 ? "just now" : `${mins} min ago`;
}
