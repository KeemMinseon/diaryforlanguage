import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptEntryFields } from "@/lib/crypto/entryFields";

const getSession = vi.fn();
let selectResult: { data: unknown; error: unknown } = { data: [], error: null };

function fakeBuilder() {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.eq = () => self;
  self.gte = () => self;
  self.lte = () => self;
  self.then = (resolve: (v: unknown) => void) => resolve(selectResult);
  return self;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getSession }, from: () => fakeBuilder() }),
}));

beforeEach(() => {
  vi.resetModules();
  getSession.mockReset();
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("GET /api/diary/entries", () => {
  it("rejects an unauthenticated request", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { GET } = await import("@/app/api/diary/entries/route");
    const res = await GET(new Request("http://x/api/diary/entries?start=2026-09-01&end=2026-09-30"));
    expect(res.status).toBe(401);
  });

  it("rejects a request missing start/end", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const { GET } = await import("@/app/api/diary/entries/route");
    const res = await GET(new Request("http://x/api/diary/entries"));
    expect(res.status).toBe(400);
  });

  it("decrypts every row in the range", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const encryptedA = encryptEntryFields({
      content: "一日目",
      overall_comment: null,
      suggestions: [],
      paragraphs: [],
    });
    const encryptedB = encryptEntryFields({
      content: "二日目",
      overall_comment: null,
      suggestions: [],
      paragraphs: [],
    });
    selectResult = {
      data: [
        { id: "e1", user_id: "u1", entry_date: "2026-09-01", readings: [], stamps: [], ...encryptedA },
        { id: "e2", user_id: "u1", entry_date: "2026-09-08", readings: [], stamps: [], ...encryptedB },
      ],
      error: null,
    };
    const { GET } = await import("@/app/api/diary/entries/route");
    const res = await GET(new Request("http://x/api/diary/entries?start=2026-09-01&end=2026-09-30"));
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].content).toBe("一日目");
    expect(body.entries[1].content).toBe("二日目");
  });
});
