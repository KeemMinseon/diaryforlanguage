import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { FINALIZE_SYSTEM_PROMPT, buildFinalizeUserMessage } from "@/lib/review/paragraphPrompt";
import { extractJson } from "@/lib/review/extractJson";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

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
      messages: [
        { role: "user", content: buildFinalizeUserMessage(fullText) },
        // Prefilling the assistant turn with "{" forces the reply to start
        // exactly at the JSON — no preamble it could get cut off before.
        { role: "assistant", content: "{" },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");
    }

    let parsed: { overallComment?: string };
    try {
      parsed = extractJson("{" + textBlock.text) as { overallComment?: string };
    } catch (parseErr) {
      console.error("Finalize: unparseable model output", textBlock.text);
      throw parseErr;
    }
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
