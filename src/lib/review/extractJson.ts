/** Pulls the JSON object out of a model response, tolerating stray text around it. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("모델 응답에서 JSON을 찾지 못했습니다.");
  }
}
