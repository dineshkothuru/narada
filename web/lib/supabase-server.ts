import "server-only";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Service-role REST access — server only; RLS keeps these tables closed to the browser.
export async function sbFetch<T>(
  path: string,
  init?: RequestInit & { returning?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (init?.returning) headers.Prefer = "return=representation";
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`supabase ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
