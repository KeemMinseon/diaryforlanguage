import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptEntryFields, decryptEntryFields } from "@/lib/crypto/entryFields";

// A fake Supabase query builder — every chain method returns itself so
// arbitrary chains (`.select().eq().gte().lte()`, `.upsert().select().single()`,
// `.select().eq().eq().maybeSingle()`) all work, and it resolves via
// `.then` (mirroring supabase-js's own thenable builder) or the two
// explicit terminal methods client.ts actually calls.
let lastUpsertPayload: unknown = null;
function fakeBuilder(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {};
  const chain = () => self;
  self.select = chain;
  self.eq = chain;
  self.gte = chain;
  self.lte = chain;
  self.order = chain;
  self.upsert = (payload: unknown) => {
    lastUpsertPayload = payload;
    return self;
  };
  self.maybeSingle = async () => result;
  self.single = async () => result;
  self.then = (resolve: (v: unknown) => void) => resolve(result);
  return self;
}

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => fakeBuilder(queryResult) }),
}));

// client.ts calls the real /api/diary/{encrypt,decrypt}-fields routes over
// HTTP — routed here straight to the real encrypt/decryptEntryFields
// functions (no Next.js server running in a vitest unit test), so this
// still exercises real AES-256-GCM, just without an HTTP hop.
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const body = JSON.parse((init?.body as string) ?? "{}");
  const items = url.includes("encrypt-fields")
    ? body.items.map(encryptEntryFields)
    : body.items.map(decryptEntryFields);
  return new Response(JSON.stringify({ items }), { status: 200 });
});

beforeEach(() => {
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  lastUpsertPayload = null;
});

describe("saveEntry", () => {
  it("sends encrypted ciphertext to Supabase, not the plaintext it was given", async () => {
    const savedRow = {
      id: "e1",
      user_id: "u1",
      entry_date: "2026-09-08",
      content: "will be overwritten by the fake upsert echo below",
      overall_comment: null,
      suggestions: [],
      readings: [],
      paragraphs: [],
      stamps: [],
    };
    queryResult = { data: savedRow, error: null };

    const { saveEntry } = await import("@/lib/diary/client");
    const result = await saveEntry({
      userId: "u1",
      dateKey: "2026-09-08",
      content: "今日は友達と会った。",
      stampKind: "keyword",
      stampKey: "chat",
      photoPath: null,
      overallComment: "잘 쓰셨어요!",
      suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
    });

    const upserted = lastUpsertPayload as { content: string; overall_comment: string };
    expect(upserted.content).not.toBe("今日は友達と会った。");
    expect(upserted.content.startsWith("v1:")).toBe(true);
    expect(upserted.overall_comment).not.toBe("잘 쓰셨어요!");

    // The caller still gets plaintext back — saveEntry merges its own
    // already-known plaintext into whatever Supabase echoed, rather than
    // handing back ciphertext or making an extra decrypt round trip.
    expect(result.content).toBe("今日は友達と会った。");
    expect(result.overall_comment).toBe("잘 쓰셨어요!");
  });
});

describe("fetchEntry", () => {
  it("decrypts an encrypted row back to plaintext", async () => {
    const encrypted = encryptEntryFields({
      content: "今日は映画を見た。",
      overall_comment: "재밌었겠다!",
      suggestions: [],
      paragraphs: [],
    });
    queryResult = {
      data: { id: "e1", user_id: "u1", entry_date: "2026-09-08", readings: [], stamps: [], ...encrypted },
      error: null,
    };

    const { fetchEntry } = await import("@/lib/diary/client");
    const entry = await fetchEntry("u1", "2026-09-08");
    expect(entry?.content).toBe("今日は映画を見た。");
    expect(entry?.overall_comment).toBe("재밌었겠다!");
  });

  it("passes a legacy plaintext row through unchanged", async () => {
    queryResult = {
      data: {
        id: "e1",
        user_id: "u1",
        entry_date: "2026-09-01",
        content: "예전에 평문으로 저장된 일기",
        overall_comment: null,
        suggestions: [],
        readings: [],
        paragraphs: [],
        stamps: [],
      },
      error: null,
    };
    const { fetchEntry } = await import("@/lib/diary/client");
    const entry = await fetchEntry("u1", "2026-09-01");
    expect(entry?.content).toBe("예전에 평문으로 저장된 일기");
  });
});
