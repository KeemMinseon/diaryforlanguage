import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserMessage } from "@/lib/review/prompt";
import type { Suggestion } from "@/types/diary";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("모델 응답에서 JSON을 찾지 못했습니다.");
  }
}

function sanitizeSuggestions(raw: unknown, content: string): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is Suggestion =>
        s &&
        typeof s === "object" &&
        typeof (s as Suggestion).original === "string" &&
        typeof (s as Suggestion).suggestion === "string" &&
        content.includes((s as Suggestion).original)
    )
    .slice(0, 8)
    .map((s) => ({
      original: s.original,
      suggestion: s.suggestion,
      note: typeof s.note === "string" ? s.note : "",
    }));
}

export async function POST(request: Request) {
  let body: { entryId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const entryId = body.entryId;
  if (!entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

  // Confirm the caller is authenticated — the admin client below bypasses
  // RLS, so this check is what actually keeps one user from triggering a
  // review for someone else's entry.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: entry, error: fetchError } = await admin
    .from("diary_entries")
    .select("id, user_id, content")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: "일기를 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.user_id !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildReviewUserMessage(entry.content ?? "") }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");
    }

    const parsed = extractJson(textBlock.text) as {
      overallComment?: string;
      suggestions?: unknown;
    };

    const overallComment =
      typeof parsed.overallComment === "string" && parsed.overallComment.trim()
        ? parsed.overallComment.trim()
        : "오늘도 일기를 써주셔서 고마워요!";
    const suggestions = sanitizeSuggestions(parsed.suggestions, entry.content ?? "");

    await admin
      .from("diary_entries")
      .update({
        status: "reviewed",
        overall_comment: overallComment,
        suggestions,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Review failed", err);
    await admin
      .from("diary_entries")
      .update({
        status: "failed",
        overall_comment: "첨삭 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
      })
      .eq("id", entryId);
    return NextResponse.json({ error: "첨삭 처리에 실패했습니다." }, { status: 500 });
  }
}
