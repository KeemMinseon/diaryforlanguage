/**
 * Deterministic keyword → stamp matching.
 *
 * When a diary entry has no photo, we pick a hand-drawn stamp motif by
 * scanning the entry text for target-language keywords. This runs
 * entirely client-side (no AI call) so the stamp appears the instant the
 * entry is saved.
 *
 * To support another target language later, add a new key to
 * `KEYWORD_RULES` (e.g. "ko", "en") with the same category ids used by
 * `STAMP_IDS` — the rest of the stamp UI is language-agnostic.
 */

export const STAMP_IDS = [
  "rain",
  "sun",
  "snow",
  "food",
  "coffee",
  "travel",
  "study",
  "sleep",
  "exercise",
  "music",
  "book",
  "heart",
  "sad",
  "work",
  "friend",
  "cat",
  "flower",
  "default",
] as const;

export type StampId = (typeof STAMP_IDS)[number];

type Locale = "ja";

/** Ordered: earlier categories win when multiple keywords match. */
const KEYWORD_RULES: Record<Locale, Array<{ id: StampId; words: string[] }>> = {
  ja: [
    { id: "rain", words: ["雨", "梅雨", "傘"] },
    { id: "snow", words: ["雪", "雪だるま"] },
    { id: "sun", words: ["晴れ", "太陽", "日差し"] },
    { id: "coffee", words: ["コーヒー", "カフェ", "紅茶", "お茶"] },
    { id: "food", words: ["ご飯", "食べ", "料理", "ラーメン", "美味し", "レストラン"] },
    { id: "sleep", words: ["眠い", "寝る", "寝坊", "布団", "疲れ"] },
    { id: "study", words: ["勉強", "宿題", "テスト", "試験", "授業", "日本語"] },
    { id: "work", words: ["仕事", "会社", "残業", "会議"] },
    { id: "travel", words: ["旅行", "電車", "空港", "飛行機", "駅"] },
    { id: "exercise", words: ["運動", "走る", "ジム", "散歩", "筋トレ"] },
    { id: "music", words: ["音楽", "歌", "ライブ", "カラオケ"] },
    { id: "book", words: ["本", "読書", "小説", "漫画"] },
    { id: "friend", words: ["友達", "友人", "会った"] },
    { id: "cat", words: ["猫", "犬", "ペット"] },
    { id: "flower", words: ["花", "桜", "公園", "紅葉"] },
    { id: "heart", words: ["好き", "嬉しい", "楽しい", "幸せ", "恋"] },
    { id: "sad", words: ["悲しい", "泣", "辛い", "寂しい"] },
  ],
};

export function pickStamp(content: string, locale: Locale = "ja"): StampId {
  const rules = KEYWORD_RULES[locale] ?? [];
  for (const rule of rules) {
    if (rule.words.some((word) => content.includes(word))) {
      return rule.id;
    }
  }
  return "default";
}
