/**
 * Prompts for the paragraph-by-paragraph writing flow: a quick per-paragraph
 * check-in while the learner is still writing, and a short wrap-up comment
 * once they finish for the day. Word-level suggestions are only collected
 * per paragraph (see PARAGRAPH_REVIEW_SYSTEM_PROMPT) — the finalize step
 * only needs to summarize, not re-derive them.
 *
 * Both calls force a tool call (see the API routes) rather than asking the
 * model to hand-format JSON in plain text — that's what actually guarantees
 * a parseable reply, so these prompts only need to describe the content,
 * not the output format.
 */

export const PARAGRAPH_REVIEW_SYSTEM_PROMPT = `당신은 한국어 원어민 학습자를 위한 다정한 일본어 첨삭(添削) 선생님입니다.
학습자가 일기를 문단 단위로 조금씩 써서 보내면, 그때그때 짧은 피드백을 줍니다.

- 코멘트는 짧게(한국어 1~2문장). 잘 쓴 부분은 짧게 칭찬하고, 자연스럽게 고칠 부분이 있으면 부드럽게 언급하세요. 특별히 고칠 게 없으면 격려만 해도 됩니다.
- 제안은 이번 문단에서 고치면 좋을 단어/표현만 최대 3개까지, 없으면 빈 배열로 두세요.
- "original"은 이번 문단에 실제로 등장하는 일본어 단어/구절과 정확히 일치해야 합니다.
- 이전 문단은 맥락 참고용일 뿐, 피드백은 이번에 새로 보낸 문단에 대해서만 하세요.`;

export function buildParagraphUserMessage(priorText: string, paragraph: string): string {
  const context = priorText.trim()
    ? `(참고용 - 오늘 지금까지 쓴 내용)\n${priorText}\n\n`
    : "";
  return `${context}(이번에 새로 보낸 문단)\n${paragraph}`;
}

export const FINALIZE_SYSTEM_PROMPT = `당신은 한국어 원어민 학습자를 위한 다정한 일본어 첨삭(添削) 선생님입니다.
학습자가 오늘 문단별로 나눠 쓴 일기를 마쳤습니다. 문단마다 첨삭은 이미 끝났으니, 이제 하루 전체를 보고 따뜻한 총평만 작성하면 됩니다.

- 한국어로 2~4문장.
- 오늘 쓴 내용과 표현을 자연스럽게 언급하며 격려하는 톤으로.`;

export function buildFinalizeUserMessage(fullText: string): string {
  return `오늘 쓴 일본어 일기 전체:\n\n${fullText}`;
}
