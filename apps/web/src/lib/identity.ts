export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeUsername(value: string): string {
  return value.toLowerCase();
}

export function validUsername(value: string): boolean {
  return (
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value)
  );
}

export function codePointLength(value: string): number {
  return [...value].length;
}

export function limitCodePoints(value: string, max: number): string {
  return codePointLength(value) <= max ? value : [...value].slice(0, max).join("");
}
