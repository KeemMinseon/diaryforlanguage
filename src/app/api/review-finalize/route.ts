import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { FINALIZE_SYSTEM_PROMPT, buildFinalizeUserMessage } from "@/lib/review/paragraphPrompt";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

// Fires once per day per entry (the "오늘 일기 마치기" tap) under normal
// use, unlike /api/review-paragraph's per-paragraph cadence — same reason
// for a limit (bounding paid Anthropic calls), just a tighter one since
// legitimate use never needs many of these in a short window.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// Same reasoning as /api/review-paragraph's own caps — a hard ceiling on
// the token cost (and therefore price) of a single request.
const MAX_FULL_TEXT_LENGTH = 20000;

const TOOL_NAME = "submit_overall_comment";

// Same reasoning as /api/review-paragraph: a forced tool call gives a
// schema-validated object back directly, rather than parsing JSON out of
// plain text (fragile) or prefilling the assistant turn (this model
// rejects prefill outright).
const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "오늘 하루 전체 일기에 대한 총평을 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      overallComment: {
        type: "string",
        description: "일기 전체에 대한 총평. 한국어 2~4문장, 격려하는 톤.",
      },
      title: {
        type: "string",
        description:
          "오늘 일기 전체 내용을 바탕으로 한 짧은 한국어 제목. 5~12자 내외, 감성적이고 시적으로 (내용 요약이 아님). 예: '비에 진 날'.",
      },
    },
    required: ["overallComment", "title"],
  },
};

/**
 * Called once, when the learner taps "오늘 일기 마치기". Each paragraph was
 * already reviewed as it was sent (see /api/review-paragraph) — this call
 * only produces the warm, whole-day overall comment shown when the entry
 * is reopened.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  // See the identical comment in /api/review-paragraph — same reasoning,
  // same fix.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(`review-finalize:${user.id}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body: { fullText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const fullText = (body.fullText ?? "").trim();
  if (!fullText) {
    return NextResponse.json({ error: "일기 내용이 비어 있습니다." }, { status: 400 });
  }
  if (fullText.length > MAX_FULL_TEXT_LENGTH) {
    return NextResponse.json({ error: "일기 내용이 너무 길어요." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // See /api/review-paragraph for why these are set explicitly: at
      // 22s with no retry, the worst case stays comfortably under this
      // route's `maxDuration` (30s) so a slow response surfaces as our
      // own friendly error below rather than the platform silently
      // killing the function mid-flight — a retry previously set here
      // (1, i.e. up to 44s across two full-length attempts) exceeded
      // that same `maxDuration` on its own.
      timeout: 22_000,
      maxRetries: 0,
    });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: FINALIZE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildFinalizeUserMessage(fullText) }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
    );
    if (!toolUse) {
      throw new Error("모델이 도구 호출 응답을 반환하지 않았습니다.");
    }

    const parsed = toolUse.input as { overallComment?: string; title?: string };
    const overallComment =
      typeof parsed.overallComment === "string" && parsed.overallComment.trim()
        ? parsed.overallComment.trim()
        : "오늘도 일기를 써주셔서 고마워요!";
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;

    return NextResponse.json({ overallComment, title });
  } catch (err) {
    console.error("Finalize failed", err);
    return NextResponse.json({ error: "총평을 정리하는 데 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
