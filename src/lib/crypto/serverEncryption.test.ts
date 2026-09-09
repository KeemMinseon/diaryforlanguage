import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptNullable,
  decryptString,
  encryptNullable,
  encryptString,
} from "@/lib/crypto/serverEncryption";

// A fixed 32-byte test key (not a real secret) — every test needs
// DIARY_ENCRYPTION_KEY set, since encryptString/decryptString throw
// without it.
beforeEach(() => {
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("encryptString / decryptString", () => {
  it("round-trips a plain string", () => {
    const ciphertext = encryptString("今日は天気がいい。");
    expect(ciphertext).not.toBe("今日は天気がいい。");
    expect(decryptString(ciphertext)).toBe("今日は天気がいい。");
  });

  it("round-trips an empty string", () => {
    const ciphertext = encryptString("");
    expect(decryptString(ciphertext)).toBe("");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptString("同じ内容");
    const b = encryptString("同じ内容");
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe("同じ内容");
    expect(decryptString(b)).toBe("同じ内容");
  });

  it("passes a legacy plaintext value straight through instead of failing to parse it", () => {
    // An entry saved before this feature existed (or never re-saved
    // since) has no "v1:" prefix at all.
    expect(decryptString("ただの平文の日記")).toBe("ただの平文の日記");
  });

  it("throws on a tampered ciphertext (auth tag mismatch)", () => {
    const ciphertext = encryptString("秘密の日記");
    const tampered = ciphertext.slice(0, -4) + "abcd";
    expect(() => decryptString(tampered)).toThrow();
  });

  it("throws when DIARY_ENCRYPTION_KEY is missing", () => {
    delete process.env.DIARY_ENCRYPTION_KEY;
    expect(() => encryptString("test")).toThrow(/DIARY_ENCRYPTION_KEY/);
  });
});

describe("encryptNullable / decryptNullable", () => {
  it("passes null straight through both ways", () => {
    expect(encryptNullable(null)).toBeNull();
    expect(decryptNullable(null)).toBeNull();
  });

  it("round-trips a non-null value", () => {
    const ciphertext = encryptNullable("총평입니다");
    expect(decryptNullable(ciphertext)).toBe("총평입니다");
  });
});
