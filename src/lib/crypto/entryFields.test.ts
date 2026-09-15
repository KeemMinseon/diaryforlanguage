import { beforeEach, describe, expect, it } from "vitest";
import { decryptEntryFields, encryptEntryFields } from "@/lib/crypto/entryFields";

beforeEach(() => {
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("encryptEntryFields / decryptEntryFields", () => {
  it("round-trips content, title, overall_comment, suggestions, and paragraph text/comment/translation", () => {
    const plain = {
      content: "今日は友達と会った。",
      title: "친구와의 하루",
      overall_comment: "잘 쓰셨어요!",
      suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
      paragraphs: [
        {
          text: "今日は友達と会った。",
          comment: "좋아요!",
          suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
          readings: [{ text: "会", reading: "あ", kind: "kanji" as const, meaning: "만나다" }],
          translation: "오늘은 친구와 만났다.",
          savedAt: "2026-09-08T00:00:00.000Z",
          session: 0,
        },
      ],
    };

    const encrypted = encryptEntryFields(plain);
    expect(encrypted.content).not.toBe(plain.content);
    expect(encrypted.title).not.toBe(plain.title);
    expect(encrypted.overall_comment).not.toBe(plain.overall_comment);
    expect(encrypted.suggestions[0].original).not.toBe(plain.suggestions[0].original);
    expect(encrypted.paragraphs[0].text).not.toBe(plain.paragraphs[0].text);
    expect(encrypted.paragraphs[0].translation).not.toBe(plain.paragraphs[0].translation);
    // Readings — the word/reading/meaning itself — are never touched.
    expect(encrypted.paragraphs[0].readings).toEqual(plain.paragraphs[0].readings);
    // Non-string metadata carries straight through untouched.
    expect(encrypted.paragraphs[0].savedAt).toBe(plain.paragraphs[0].savedAt);
    expect(encrypted.paragraphs[0].session).toBe(plain.paragraphs[0].session);

    expect(decryptEntryFields(encrypted)).toEqual(plain);
  });

  it("passes a null title/overall_comment straight through", () => {
    const plain = { content: "", title: null, overall_comment: null, suggestions: [], paragraphs: [] };
    const encrypted = encryptEntryFields(plain);
    expect(encrypted.title).toBeNull();
    expect(encrypted.overall_comment).toBeNull();
    expect(decryptEntryFields(encrypted).title).toBeNull();
    expect(decryptEntryFields(encrypted).overall_comment).toBeNull();
  });

  it("decrypts a legacy plaintext entry (never encrypted) without error", () => {
    const legacy = {
      content: "예전에 평문으로 저장된 일기",
      title: null,
      overall_comment: "총평도 평문",
      suggestions: [{ original: "a", suggestion: "b", note: "c" }],
      paragraphs: [],
    };
    expect(decryptEntryFields(legacy)).toEqual(legacy);
  });

  it("defaults a legacy paragraph's missing translation to an empty string", () => {
    const legacy = {
      content: "",
      title: null,
      overall_comment: null,
      suggestions: [],
      paragraphs: [
        {
          text: "今日は友達と会った。",
          comment: "좋아요!",
          suggestions: [],
          readings: [],
          savedAt: "2026-09-08T00:00:00.000Z",
          session: 0,
        },
      ],
    };
    const encrypted = encryptEntryFields(legacy);
    expect(decryptEntryFields(encrypted).paragraphs[0].translation).toBe("");
  });
});
