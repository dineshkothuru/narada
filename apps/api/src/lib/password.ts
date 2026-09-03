import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEY_BYTES = 32;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const FORMAT = new RegExp(
  `^scrypt\\$v=1\\$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}\\$([A-Za-z0-9_-]+)\\$([A-Za-z0-9_-]+)$`,
);

export function isStrictPasswordHash(encoded: unknown): encoded is string {
  if (typeof encoded !== "string") return false;
  const match = FORMAT.exec(encoded);
  if (!match) return false;
  const salt = Buffer.from(match[1], "base64url");
  const key = Buffer.from(match[2], "base64url");
  return salt.length >= SCRYPT_SALT_BYTES && key.length === SCRYPT_KEY_BYTES;
}

function scryptAsync(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const key = await scryptAsync(password, salt, SCRYPT_KEY_BYTES);
  return `scrypt$v=1$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    if (!isStrictPasswordHash(encoded)) return false;
    const [, , , saltText, keyText] = encoded.split("$");
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    const actual = await scryptAsync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
