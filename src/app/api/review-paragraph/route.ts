import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PARAGRAPH_REVIEW_SYSTEM_PROMPT, buildParagraphUserMessage } from "@/lib/review/paragraphPrompt";
import type { Reading, Suggestion } from "@/types/diary";

export const runtime = "nodejs";
export const maxDuration = 45;

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
        description:
          "한자 부분의 히라가나 읽는 법 + 가타카나 단어의 로마자 표기 (중복 단어는 한 번만). 문단 원문뿐 아니라 suggestion 문장에 새로 나오는 한자/가타카나도 포함.",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "문단 또는 suggestion 문장에 실제로 등장하는 표기와 정확히 일치해야 함 (한자는 오쿠리가나 제외).",
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

// `scanText` is the paragraph plus every suggestion's replacement text —
// readings aren't just for what the learner wrote, they also need to cover
// any new kanji/katakana the model introduces when translating a Korean
// phrase the learner mixed in (the learner has never seen that word, so it
// needs a reading even more than stuff they already typed themselves).
function sanitizeReadings(raw: unknown, scanText: string): Reading[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Reading =>
        r &&
        typeof r === "object" &&
        typeof (r as Reading).text === "string" &&
        typeof (r as Reading).reading === "string" &&
        ((r as Reading).kind === "kanji" || (r as Reading).kind === "katakana") &&
        scanText.includes((r as Reading).text)
    )
    .map((r) => ({ text: r.text, reading: r.reading, kind: r.kind }));
}

// The model is told to be exhaustive about readings, but in practice still
// occasionally skips a kanji run or katakana word (observed: 事務所/行き
// missing while everything else in the same paragraph was covered). Rather
// than trust the prompt alone, scan `scanText` ourselves for every kanji
// run and katakana word and check it against what came back; anything left
// uncovered gets one focused follow-up call asking only for those.
const KANJI_RUN_RE = /[一-鿿㐀-䶿]+/gu;
const KATAKANA_RUN_RE = /[゠-ヿ]+/gu;

function coverageMask(scanText: string, readings: Reading[], kind: Reading["kind"]): boolean[] {
  const mask = new Array(scanText.length).fill(false);
  for (const r of readings) {
    if (r.kind !== kind || !r.text) continue;
    let idx = scanText.indexOf(r.text);
    while (idx !== -1) {
      for (let i = idx; i < idx + r.text.length; i++) mask[i] = true;
      idx = scanText.indexOf(r.text, idx + 1);
    }
  }
  return mask;
}

function findMissingRuns(
  scanText: string,
  readings: Reading[],
  re: RegExp,
  kind: Reading["kind"]
): string[] {
  const mask = coverageMask(scanText, readings, kind);
  const missing = new Set<string>();
  for (const m of scanText.matchAll(re)) {
    const start = m.index;
    if (start === undefined) continue;
    const end = start + m[0].length;
    let covered = true;
    for (let i = start; i < end; i++) {
      if (!mask[i]) {
        covered = false;
        break;
      }
    }
    if (!covered) missing.add(m[0]);
  }
  return [...missing];
}

const MISSING_READINGS_TOOL_NAME = "submit_missing_readings";
const MISSING_READINGS_TOOL: Anthropic.Tool = {
  name: MISSING_READINGS_TOOL_NAME,
  description: "주어진 한자/가타카나 표기 목록 전체에 대한 읽기를 채워 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      readings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "입력받은 표기를 그대로 복사." },
            reading: { type: "string", description: "한자는 히라가나, 가타카나는 로마자." },
          },
          required: ["text", "reading"],
        },
      },
    },
    required: ["readings"],
  },
};

/**
 * One narrow follow-up call for readings the main call missed. Restricting
 * the model to a fixed, already-known-correct list of texts (extracted from
 * `scanText` itself via regex, not by the model) makes this a much easier,
 * more reliable task than "find everything" — and the result can't
 * introduce a text that doesn't actually appear in the paragraph/suggestions.
 */
async function fetchMissingReadings(
  anthropic: Anthropic,
  scanText: string,
  missing: { text: string; kind: Reading["kind"] }[]
): Promise<Reading[]> {
  const list = missing.map((m) => `- ${m.text} (${m.kind === "kanji" ? "한자" : "가타카나"})`).join("\n");
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      "당신은 일본어 첨삭 선생님입니다. 주어진 목록에 있는 한자/가타카나 표기 전부에 대해 정확한 읽기를 답하세요. 한자는 히라가나, 가타카나는 로마자로 답하세요. 목록에 없는 항목은 만들지 말고, 목록에 있는 건 하나도 빠짐없이 포함하세요. \"text\"는 입력받은 표기를 절대 바꾸지 말고 그대로 돌려주세요.",
    messages: [
      {
        role: "user",
        content: `문단과 제안 문장 (읽기를 판단할 때 맥락으로 참고):\n${scanText}\n\n다음 표기들의 읽기를 알려주세요:\n${list}`,
      },
    ],
    tools: [MISSING_READINGS_TOOL],
    tool_choice: { type: "tool", name: MISSING_READINGS_TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === MISSING_READINGS_TOOL_NAME
  );
  if (!toolUse) return [];

  const parsed = toolUse.input as { readings?: unknown };
  if (!Array.isArray(parsed.readings)) return [];

  const kindByText = new Map(missing.map((m) => [m.text, m.kind]));
  return parsed.readings
    .filter(
      (r): r is { text: string; reading: string } =>
        !!r &&
        typeof r === "object" &&
        typeof (r as { text?: unknown }).text === "string" &&
        typeof (r as { reading?: unknown }).reading === "string" &&
        kindByText.has((r as { text: string }).text)
    )
    .map((r) => ({ text: r.text, reading: r.reading, kind: kindByText.get(r.text)! }));
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
      max_tokens: 1200,
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
    // Readings must cover suggestion text too (e.g. a Korean phrase the
    // learner mixed in gets translated into new Japanese in `suggestion` —
    // that's kanji/katakana the learner never wrote, so it needs a reading
    // more than anything they typed themselves).
    const scanText = [paragraph, ...suggestions.map((s) => s.suggestion)].join("\n");
    let readings = sanitizeReadings(parsed.readings, scanText);

    const missing = [
      ...findMissingRuns(scanText, readings, KANJI_RUN_RE, "kanji").map((text) => ({
        text,
        kind: "kanji" as const,
      })),
      ...findMissingRuns(scanText, readings, KATAKANA_RUN_RE, "katakana")
        // A lone chouon mark (ー) can appear inside an otherwise-hiragana
        // word (e.g. casual "みーてぃんぐ") and matches the katakana range
        // on its own — not a real katakana word, so skip it.
        .filter((text) => !/^ー+$/.test(text))
        .map((text) => ({ text, kind: "katakana" as const })),
    ];
    if (missing.length > 0) {
      try {
        const extra = await fetchMissingReadings(anthropic, scanText, missing);
        readings = [...readings, ...extra];
      } catch (err) {
        console.error("Failed to backfill missing readings", err);
      }
    }

    return NextResponse.json({ comment, suggestions, readings });
  } catch (err) {
    console.error("Paragraph review failed", err);
    return NextResponse.json({ error: "이 문단을 첨삭하는 데 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
