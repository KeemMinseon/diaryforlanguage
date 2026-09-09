import { beforeEach, describe, expect, it, vi } from "vitest";

// The route only ever calls `createClient()` to check who's logged in —
// mocked here so this test doesn't need a live Supabase project (the
// real client would otherwise make a genuine network call to validate
// the session cookie).
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

async function importRoute() {
  return await import("@/app/api/diary/encrypt-fields/route");
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("POST /api/diary/encrypt-fields", () => {
  it("rejects an unauthenticated request", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://x/api/diary/encrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("encrypts each item's fields for a logged-in user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await importRoute();
    const plain = {
      content: "今日は友達と会った。",
      overall_comment: "잘 쓰셨어요!",
      suggestions: [{ original: "会った", suggestion: "会いました", note: "존댓말로" }],
      paragraphs: [],
    };
    const res = await POST(
      new Request("http://x/api/diary/encrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: [plain] }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const [encrypted] = body.items;
    expect(encrypted.content).not.toBe(plain.content);
    expect(encrypted.content.startsWith("v1:")).toBe(true);
    expect(encrypted.overall_comment).not.toBe(plain.overall_comment);
    expect(encrypted.suggestions[0].original).not.toBe(plain.suggestions[0].original);
  });

  it("rejects a malformed body", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://x/api/diary/encrypt-fields", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });
});
