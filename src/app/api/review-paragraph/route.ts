import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PARAGRAPH_REVIEW_SYSTEM_PROMPT, buildParagraphUserMessage } from "@/lib/review/paragraphPrompt";
import { extractJson } from "@/lib/review/extractJson";
import type { Suggestion } from "@/types/diary";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

function sanitizeSuggestions(raw: unknown, paragraph: string): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is Suggestion =>
        s &&
        typeof s === "object" &&
        typeof (s as Suggestion).original === "string" &&
        typeof (s as Suggestion).suggestion === "string" &&
        paragraph.includes((s as Suggestion).original)
    )
    .slice(0, 3)
    .map((s) => ({
      original: s.original,
      suggestion: s.suggestion,
      note: typeof s.note === "string" ? s.note : "",
    }));
}

/**
 * Reviews a single paragraph while the learner is still writing — called
 * synchronously each time they send one, so it stays quick and focused
 * (short reply, at most a few word-level suggestions).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { paragraph?: string; priorText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const paragraph = (body.paragraph ?? "").trim();
  if (!paragraph) {
    return NextResponse.json({ error: "문단 내용이 비어 있습니다." }, { status: 400 });
  }
  const priorText = typeof body.priorText === "string" ? body.priorText : "";

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: PARAGRAPH_REVIEW_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildParagraphUserMessage(priorText, paragraph) },
        // Prefilling the assistant turn with "{" forces the reply to start
        // exactly at the JSON — no preamble it could get cut off before.
        { role: "assistant", content: "{" },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");
    }

    let parsed: { comment?: string; suggestions?: unknown };
    try {
      parsed = extractJson("{" + textBlock.text) as { comment?: string; suggestions?: unknown };
    } catch (parseErr) {
      console.error("Paragraph review: unparseable model output", textBlock.text);
      throw parseErr;
    }
    const comment =
      typeof parsed.comment === "string" && parsed.comment.trim()
        ? parsed.comment.trim()
        : "좋아요, 계속 이어서 써보세요!";
    const suggestions = sanitizeSuggestions(parsed.suggestions, paragraph);

    return NextResponse.json({ comment, suggestions });
  } catch (err) {
    console.error("Paragraph review failed", err);
    return NextResponse.json({ error: "이 문단을 첨삭하는 데 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
