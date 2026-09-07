import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { FINALIZE_SYSTEM_PROMPT, buildFinalizeUserMessage } from "@/lib/review/paragraphPrompt";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

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
    },
    required: ["overallComment"],
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
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

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    const parsed = toolUse.input as { overallComment?: string };
    const overallComment =
      typeof parsed.overallComment === "string" && parsed.overallComment.trim()
        ? parsed.overallComment.trim()
        : "오늘도 일기를 써주셔서 고마워요!";

    return NextResponse.json({ overallComment });
  } catch (err) {
    console.error("Finalize failed", err);
    return NextResponse.json({ error: "총평을 정리하는 데 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
