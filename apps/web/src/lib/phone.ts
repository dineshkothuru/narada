export const PHONE_PATTERN = /^\+\d{8,15}$/;

// Keep international input explicit. Formatting characters are harmless, but
// a missing `+` must stay invalid instead of being assigned a guessed country.
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

export function validPhone(value: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(value));
}
