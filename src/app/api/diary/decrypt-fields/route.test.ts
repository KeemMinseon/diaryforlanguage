import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  process.env.DIARY_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("POST /api/diary/decrypt-fields", () => {
  it("rejects an unauthenticated request", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/diary/decrypt-fields/route");
    const res = await POST(
      new Request("http://x/api/diary/decrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("passes a legacy plaintext row straight through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("@/app/api/diary/decrypt-fields/route");
    const legacy = {
      content: "예전에 평문으로 저장된 일기",
      overall_comment: null,
      suggestions: [],
      paragraphs: [],
    };
    const res = await POST(
      new Request("http://x/api/diary/decrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: [legacy] }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toEqual(legacy);
  });

  it("round-trips real ciphertext produced by /api/diary/encrypt-fields", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const encryptRoute = await import("@/app/api/diary/encrypt-fields/route");
    const plain = {
      content: "今日は映画を見た。",
      overall_comment: "재밌었겠다!",
      suggestions: [{ original: "見た", suggestion: "見ました", note: "존댓말" }],
      paragraphs: [
        {
          text: "今日は映画を見た。",
          comment: "좋아요",
          suggestions: [],
          readings: [{ text: "映画", reading: "えいが", kind: "kanji" as const, meaning: "영화" }],
          savedAt: "2026-09-08T00:00:00.000Z",
          session: 0,
        },
      ],
    };
    const encryptRes = await encryptRoute.POST(
      new Request("http://x/api/diary/encrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: [plain] }),
      })
    );
    const { items: encryptedItems } = await encryptRes.json();

    const { POST: decryptPOST } = await import("@/app/api/diary/decrypt-fields/route");
    const decryptRes = await decryptPOST(
      new Request("http://x/api/diary/decrypt-fields", {
        method: "POST",
        body: JSON.stringify({ items: encryptedItems }),
      })
    );
    const { items: decryptedItems } = await decryptRes.json();
    expect(decryptedItems[0]).toEqual(plain);
  });
});
