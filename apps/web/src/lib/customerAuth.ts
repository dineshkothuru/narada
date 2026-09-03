export function safeCustomerNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  try {
    const target = new URL(next, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      target.pathname === "/login" ||
      target.pathname === "/signup"
    ) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
