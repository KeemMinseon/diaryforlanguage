import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptEntryFields } from "@/lib/crypto/entryFields";

const getUser = vi.fn();
let selectResult: { data: unknown; error: unknown } = { data: null, error: null };

function fakeBuilder() {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.eq = () => self;
  self.maybeSingle = async () => selectResult;
  return self;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: () => fakeBuilder() }),
}));

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("GET /api/diary/entry", () => {
  it("rejects an unauthenticated request", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/diary/entry/route");
    const res = await GET(new Request("http://x/api/diary/entry?date=2026-09-08"));
    expect(res.status).toBe(401);
  });

  it("rejects a request with no date", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { GET } = await import("@/app/api/diary/entry/route");
    const res = await GET(new Request("http://x/api/diary/entry"));
    expect(res.status).toBe(400);
  });

  it("returns entry: null when nothing exists for that date", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    selectResult = { data: null, error: null };
    const { GET } = await import("@/app/api/diary/entry/route");
    const res = await GET(new Request("http://x/api/diary/entry?date=2026-01-01"));
    const body = await res.json();
    expect(body.entry).toBeNull();
  });

  it("decrypts a found row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const encrypted = encryptEntryFields({
      content: "今日は映画を見た。",
      overall_comment: "재밌었겠다!",
      suggestions: [],
      paragraphs: [],
    });
    selectResult = {
      data: {
        id: "e1",
        user_id: "u1",
        entry_date: "2026-09-08",
        readings: [],
        stamps: [],
        ...encrypted,
      },
      error: null,
    };
    const { GET } = await import("@/app/api/diary/entry/route");
    const res = await GET(new Request("http://x/api/diary/entry?date=2026-09-08"));
    const body = await res.json();
    expect(body.entry.content).toBe("今日は映画を見た。");
    expect(body.entry.overall_comment).toBe("재밌었겠다!");
  });
});
