import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
let upsertPayload: unknown = null;
let upsertResult: { data: unknown; error: unknown } = { data: null, error: null };

function fakeBuilder() {
  const self: Record<string, unknown> = {};
  self.upsert = (payload: unknown) => {
    upsertPayload = payload;
    return self;
  };
  self.select = () => self;
  self.single = async () => upsertResult;
  return self;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: () => fakeBuilder() }),
}));

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  upsertPayload = null;
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("POST /api/diary/save", () => {
  it("rejects an unauthenticated request", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/diary/save/route");
    const res = await POST(
      new Request("http://x/api/diary/save", {
        method: "POST",
        body: JSON.stringify({ dateKey: "2026-09-08", content: "x", stampKind: "keyword" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a malformed body", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("@/app/api/diary/save/route");
    const res = await POST(
      new Request("http://x/api/diary/save", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
  });

  it("encrypts content/overall_comment/suggestions/paragraphs before upserting, using the session's own user id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    upsertResult = {
      data: {
        id: "e1",
        user_id: "u1",
        entry_date: "2026-09-08",
        stamp_kind: "keyword",
        stamp_key: "chat",
        photo_path: null,
        status: "reviewed",
        readings: [],
        paragraphs: [],
        stamps: [],
        content: "placeholder-overwritten-by-route",
        overall_comment: null,
        suggestions: [],
      },
      error: null,
    };

    const { POST } = await import("@/app/api/diary/save/route");
    const res = await POST(
      new Request("http://x/api/diary/save", {
        method: "POST",
        body: JSON.stringify({
          userId: "someone-elses-id", // must be ignored — the route uses the session's own id
          dateKey: "2026-09-08",
          content: "今日は友達と会った。",
          stampKind: "keyword",
          stampKey: "chat",
          photoPath: null,
          overallComment: "잘 쓰셨어요!",
          suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
        }),
      })
    );
    expect(res.status).toBe(200);

    const written = upsertPayload as { user_id: string; content: string; overall_comment: string };
    expect(written.user_id).toBe("u1");
    expect(written.content).not.toBe("今日は友達と会った。");
    expect(written.content.startsWith("v1:")).toBe(true);
    expect(written.overall_comment).not.toBe("잘 쓰셨어요!");

    const body = await res.json();
    expect(body.entry.content).toBe("今日は友達と会った。");
    expect(body.entry.overall_comment).toBe("잘 쓰셨어요!");
  });
});
