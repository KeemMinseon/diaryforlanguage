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

// Ordered: earlier categories win when multiple keywords match in the same
// entry. Weather goes first (explicit, rarely the *point* of an entry that
// also mentions something else). Specific, eventful categories come next —
// a day is more "friend"/"work"/"travel" than it is "food" just because a
// meal got mentioned along the way. "coffee"/"food" go last, right before
// the fallback: almost every entry mentions eating or drinking *something*
// incidentally ("식사를 걸렀다", "야근하고 늦게 저녁을 먹었다"), so a bare
// "먹었다"/"food" match shouldn't outrank whatever the entry was actually
// about — it should only win when nothing more specific also matched.
const KEYWORD_RULES: Record<Locale, Array<{ id: StampId; words: string[] }>> = {
  ja: [
    { id: "rain", words: ["雨", "梅雨", "傘", "台風"] },
    { id: "snow", words: ["雪", "雪だるま", "雪合戦"] },
    { id: "sun", words: ["晴れ", "太陽", "日差し", "暑い", "猛暑"] },
    { id: "flower", words: ["花", "桜", "公園", "紅葉", "植物", "庭"] },
    { id: "travel", words: ["旅行", "電車", "空港", "飛行機", "駅", "旅", "海外", "ホテル", "新幹線"] },
    { id: "exercise", words: ["運動", "走る", "ジム", "散歩", "筋トレ", "ヨガ", "水泳", "サッカー", "バスケ"] },
    { id: "music", words: ["音楽", "歌", "ライブ", "カラオケ", "コンサート", "バンド"] },
    { id: "book", words: ["本", "読書", "小説", "漫画", "図書館", "雑誌"] },
    { id: "cat", words: ["猫", "犬", "ペット", "動物"] },
    { id: "friend", words: ["友達", "友人", "会った", "同僚", "飲み会"] },
    { id: "heart", words: ["好き", "嬉しい", "楽しい", "幸せ", "恋", "感謝"] },
    { id: "sad", words: ["悲しい", "泣", "辛い", "寂しい", "落ち込", "不安", "心配"] },
    { id: "study", words: ["勉強", "宿題", "テスト", "試験", "授業", "日本語", "留学"] },
    { id: "work", words: ["仕事", "会社", "残業", "会議", "出張", "上司"] },
    { id: "sleep", words: ["眠い", "寝る", "寝坊", "布団", "疲れ", "寝不足"] },
    { id: "coffee", words: ["コーヒー", "カフェ", "紅茶", "お茶"] },
    { id: "food", words: ["ご飯", "食べ", "料理", "ラーメン", "美味し", "レストラン", "居酒屋"] },
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
