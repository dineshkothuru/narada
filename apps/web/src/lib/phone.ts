export const PHONE_PATTERN = /^\+\d{8,15}$/;
export const COUNTRY_CODE_PATTERN = /^\+\d{1,3}$/;
export const NATIONAL_PHONE_PATTERN = /^\d{5,14}$/;
export const DEFAULT_COUNTRY_CODE = "+91";

// Keep international input explicit. Formatting characters are harmless, but
// a missing `+` must stay invalid instead of being assigned a guessed country.
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

export function normalizeCountryCode(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : trimmed.startsWith("+") ? "+" : "";
}

export function normalizeNationalPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function composePhone(countryCode: string, nationalNumber: string): string {
  return normalizePhone(
    `${normalizeCountryCode(countryCode)}${normalizeNationalPhone(nationalNumber)}`,
  );
}

export function validPhone(value: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(value));
}
