export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins === 0 ? "just now" : `${mins} min ago`;
}
