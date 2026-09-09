import { beforeEach, describe, expect, it } from "vitest";
import { decryptEntryFields, encryptEntryFields } from "@/lib/crypto/entryFields";

beforeEach(() => {
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("encryptEntryFields / decryptEntryFields", () => {
  it("round-trips content, overall_comment, suggestions, and paragraph text/comment", () => {
    const plain = {
      content: "今日は友達と会った。",
      overall_comment: "잘 쓰셨어요!",
      suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
      paragraphs: [
        {
          text: "今日は友達と会った。",
          comment: "좋아요!",
          suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
          readings: [{ text: "会", reading: "あ", kind: "kanji" as const, meaning: "만나다" }],
          savedAt: "2026-09-08T00:00:00.000Z",
          session: 0,
        },
      ],
    };

    const encrypted = encryptEntryFields(plain);
    expect(encrypted.content).not.toBe(plain.content);
    expect(encrypted.overall_comment).not.toBe(plain.overall_comment);
    expect(encrypted.suggestions[0].original).not.toBe(plain.suggestions[0].original);
    expect(encrypted.paragraphs[0].text).not.toBe(plain.paragraphs[0].text);
    // Readings — the word/reading/meaning itself — are never touched.
    expect(encrypted.paragraphs[0].readings).toEqual(plain.paragraphs[0].readings);
    // Non-string metadata carries straight through untouched.
    expect(encrypted.paragraphs[0].savedAt).toBe(plain.paragraphs[0].savedAt);
    expect(encrypted.paragraphs[0].session).toBe(plain.paragraphs[0].session);

    expect(decryptEntryFields(encrypted)).toEqual(plain);
  });

  it("passes a null overall_comment straight through", () => {
    const plain = { content: "", overall_comment: null, suggestions: [], paragraphs: [] };
    const encrypted = encryptEntryFields(plain);
    expect(encrypted.overall_comment).toBeNull();
    expect(decryptEntryFields(encrypted).overall_comment).toBeNull();
  });

  it("decrypts a legacy plaintext entry (never encrypted) without error", () => {
    const legacy = {
      content: "예전에 평문으로 저장된 일기",
      overall_comment: "총평도 평문",
      suggestions: [{ original: "a", suggestion: "b", note: "c" }],
      paragraphs: [],
    };
    expect(decryptEntryFields(legacy)).toEqual(legacy);
  });
});
