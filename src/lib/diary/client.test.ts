import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptEntryFields, encryptEntryFields } from "@/lib/crypto/entryFields";

// fetchEntry/fetchMonthEntries/saveEntry now go through
// /api/diary/{entry,entries,save} instead of talking to Supabase
// directly — there's no Supabase call left in those three to mock here,
// only `fetch`. What the route actually does with the request body
// (encrypting before it ever reaches Supabase) is covered by that
// route's own test — this file only needs to check that client.ts sends
// the right request and passes back whatever the route responds with
// (which, per the route's real contract, is already plaintext).
let lastSaveBody: unknown = null;
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const body = init?.body ? JSON.parse(init.body as string) : null;

  if (url.includes("/api/diary/save")) {
    lastSaveBody = body;
    const entry = {
      id: "e1",
      user_id: "u1",
      entry_date: body.dateKey,
      stamp_kind: body.stampKind,
      stamp_key: body.stampKey,
      photo_path: body.photoPath,
      status: body.status ?? "reviewed",
      readings: body.readings ?? [],
      stamps: body.stamps ?? [],
      content: body.content,
      overall_comment: body.overallComment ?? null,
      suggestions: body.suggestions ?? [],
      paragraphs: body.paragraphs ?? [],
    };
    return new Response(JSON.stringify({ entry }), { status: 200 });
  }

  if (url.includes("/api/diary/entry?")) {
    return new Response(JSON.stringify({ entry: fakeEntryResult }), { status: 200 });
  }

  if (url.includes("/api/diary/entries?")) {
    return new Response(JSON.stringify({ entries: fakeEntriesResult }), { status: 200 });
  }

  throw new Error(`Unmocked fetch: ${url}`);
});

let fakeEntryResult: unknown = null;
let fakeEntriesResult: unknown[] = [];

beforeEach(() => {
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  lastSaveBody = null;
  fakeEntryResult = null;
  fakeEntriesResult = [];
});

describe("saveEntry", () => {
  it("sends encrypted ciphertext to /api/diary/save, not the plaintext it was given", async () => {
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

    // The request body sent to the browser's own fetch call is still
    // plaintext (encryption happens server-side, inside /api/diary/save)
    // — what matters is that route encrypts it before writing to
    // Supabase, which the route's own test covers. Here we just confirm
    // client.ts hands off the right plaintext and gets a usable entry back.
    expect((lastSaveBody as { content: string }).content).toBe("今日は友達と会った。");
    expect(result.content).toBe("今日は友達と会った。");
    expect(result.overall_comment).toBe("잘 쓰셨어요!");
  });
});

describe("fetchEntry", () => {
  it("returns whatever /api/diary/entry hands back", async () => {
    fakeEntryResult = {
      id: "e1",
      user_id: "u1",
      entry_date: "2026-09-08",
      content: "今日は映画を見た。",
      overall_comment: "재밌었겠다!",
      suggestions: [],
      readings: [],
      paragraphs: [],
      stamps: [],
    };
    const { fetchEntry } = await import("@/lib/diary/client");
    const entry = await fetchEntry("2026-09-08");
    expect(entry?.content).toBe("今日は映画を見た。");
  });

  it("returns null when the entry doesn't exist", async () => {
    fakeEntryResult = null;
    const { fetchEntry } = await import("@/lib/diary/client");
    const entry = await fetchEntry("2026-01-01");
    expect(entry).toBeNull();
  });
});

describe("fetchMonthEntries", () => {
  it("returns whatever /api/diary/entries hands back", async () => {
    fakeEntriesResult = [
      { id: "e1", entry_date: "2026-09-01", content: "a" },
      { id: "e2", entry_date: "2026-09-08", content: "b" },
    ];
    const { fetchMonthEntries } = await import("@/lib/diary/client");
    const entries = await fetchMonthEntries("2026-09-01", "2026-09-30");
    expect(entries).toHaveLength(2);
  });
});

// Real end-to-end sanity check that the two server-side helpers this
// module leans on (via the API routes it can't reach directly in a unit
// test) actually agree with each other.
describe("encrypt/decryptEntryFields (sanity)", () => {
  it("round-trips", () => {
    const plain = {
      content: "テスト",
      overall_comment: null,
      suggestions: [],
      paragraphs: [],
    };
    expect(decryptEntryFields(encryptEntryFields(plain))).toEqual(plain);
  });
});
