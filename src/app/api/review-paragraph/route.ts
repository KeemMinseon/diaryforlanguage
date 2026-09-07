import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PARAGRAPH_REVIEW_SYSTEM_PROMPT, buildParagraphUserMessage } from "@/lib/review/paragraphPrompt";
import type { Reading, Suggestion } from "@/types/diary";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-5";

const TOOL_NAME = "submit_paragraph_feedback";

// A forced tool call gets us a schema-validated object back directly (as
// `input`) — no asking the model to hand-format JSON in plain text, which
// is what actually made this reliable (that approach was failing: some
// replies had preamble before the JSON, or got cut off before ever
// reaching it). Assistant-message prefill was tried as a fix first, but
// this model rejects prefill entirely ("must end with a user message"),
// so tool use is both the fix and the more robust design either way.
const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "학습자가 방금 보낸 한 문단에 대한 첨삭 피드백을 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      comment: {
        type: "string",
        description: "이번 문단에 대한 짧은 코멘트, 한국어 1~2문장.",
      },
      suggestions: {
        type: "array",
        description: "고치면 좋을 단어/표현 (최대 3개, 없으면 빈 배열).",
        items: {
          type: "object",
          properties: {
            original: {
              type: "string",
              description: "문단에 실제로 등장하는 일본어 단어/구절과 정확히 일치해야 함.",
            },
            suggestion: { type: "string", description: "자연스러운 대체 표현." },
            note: { type: "string", description: "왜 그렇게 고치면 좋은지 한국어로 짧게 (1문장)." },
          },
          required: ["original", "suggestion", "note"],
        },
      },
      readings: {
        type: "array",
        description: "한자 부분의 히라가나 읽는 법 + 가타카나 단어의 로마자 표기 (중복 단어는 한 번만).",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "문단에 실제로 등장하는 표기와 정확히 일치해야 함 (한자는 오쿠리가나 제외).",
            },
            reading: { type: "string", description: "한자는 히라가나, 가타카나는 로마자." },
            kind: { type: "string", enum: ["kanji", "katakana"] },
          },
          required: ["text", "reading", "kind"],
        },
      },
    },
    required: ["comment", "suggestions", "readings"],
  },
};

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

function sanitizeReadings(raw: unknown, paragraph: string): Reading[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Reading =>
        r &&
        typeof r === "object" &&
        typeof (r as Reading).text === "string" &&
        typeof (r as Reading).reading === "string" &&
        ((r as Reading).kind === "kanji" || (r as Reading).kind === "katakana") &&
        paragraph.includes((r as Reading).text)
    )
    .map((r) => ({ text: r.text, reading: r.reading, kind: r.kind }));
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
      messages: [{ role: "user", content: buildParagraphUserMessage(priorText, paragraph) }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
    );
    if (!toolUse) {
      throw new Error("모델이 도구 호출 응답을 반환하지 않았습니다.");
    }

    const parsed = toolUse.input as { comment?: string; suggestions?: unknown; readings?: unknown };
    const comment =
      typeof parsed.comment === "string" && parsed.comment.trim()
        ? parsed.comment.trim()
        : "좋아요, 계속 이어서 써보세요!";
    const suggestions = sanitizeSuggestions(parsed.suggestions, paragraph);
    const readings = sanitizeReadings(parsed.readings, paragraph);

    return NextResponse.json({ comment, suggestions, readings });
  } catch (err) {
    console.error("Paragraph review failed", err);
    return NextResponse.json({ error: "이 문단을 첨삭하는 데 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
