import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password.js";

describe("password hashing", () => {
  it("round-trips a password with a random encoded salt", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(first, "wrong horse battery staple")).toBe(false);
  });

  it("rejects hashes with an unknown algorithm or malformed fields", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(
      await verifyPassword(hash.replace("scrypt$", "argon2$"), "correct horse battery staple"),
    ).toBe(false);
    expect(await verifyPassword(`${hash}$extra`, "correct horse battery staple")).toBe(false);
  });
});
