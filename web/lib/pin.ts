import "server-only";

// Staff PINs are salted and hashed. They were stored in plaintext, which meant
// anyone who could read the staff table could sign in as the owner. A PIN is
// only four digits, so a fast hash would fall to a trivial brute force — the
// per-restaurant salt plus many iterations makes an offline sweep of the whole
// keyspace cost real time instead of microseconds.
const ITERATIONS = 120_000;

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(`narada:${salt}`), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Compared without an early exit, so the time taken says nothing about how much
// of the hash matched.
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
