import { describe, expect, it } from "vitest";
import { LANGS, STRINGS, type Lang } from "../src/i18n";

function checkValue(value: unknown, path: string) {
  if (typeof value === "function") return; // e.g. items(n)
  if (Array.isArray(value)) {
    expect(value.length, `${path} should be non-empty array`).toBeGreaterThan(0);
    for (const [i, v] of value.entries()) checkValue(v, `${path}[${i}]`);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) checkValue(v, `${path}.${k}`);
    return;
  }
  expect(typeof value, `${path} should be a string`).toBe("string");
  expect((value as string).length, `${path} should be non-empty`).toBeGreaterThan(0);
}

describe("STRINGS", () => {
  const langs: Lang[] = ["hi", "te"];
  const enKeys = Object.keys(STRINGS.en);

  for (const lang of langs) {
    it(`has every en key present in ${lang} with a non-empty value`, () => {
      for (const key of enKeys) {
        expect(STRINGS[lang], `${lang} missing key "${key}"`).toHaveProperty(key);
        checkValue((STRINGS[lang] as Record<string, unknown>)[key], `${lang}.${key}`);
      }
    });
  }
});

describe("LANGS", () => {
  it("codes match the keys of STRINGS", () => {
    const langCodes = LANGS.map((l) => l.code).sort();
    const stringsKeys = Object.keys(STRINGS).sort();
    expect(langCodes).toEqual(stringsKeys);
  });
});
