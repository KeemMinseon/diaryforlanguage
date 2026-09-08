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
  "joy",
  "sad",
  "work",
  "cat",
  "flower",
  // Added on request — each now has its own built-in hand-drawn icon in
  // StampIcon.tsx, same line-art style as the original set above. A custom
  // image uploaded to the "stamp-icons" Storage bucket as "<id>.<ext>"
  // (e.g. "celebration.svg") still overrides that immediately, the same
  // way every other keyword stamp's icon can be replaced. See
  // KeywordIcon.tsx / useStorageImageOverride for that mechanism.
  "celebration",
  "shopping",
  "movie",
  "phone",
  "rest",
  "cook",
  "dog",
  "cloud",
  "bread",
  // "friend" was dropped — its single icon didn't fit every friend-related
  // entry equally well. Split by what the entry is actually about instead:
  // an actual get-together/plan reads as "calendar", just mentioning a
  // friend in passing (e.g. while talking about something else) reads as
  // "chat".
  "calendar",
  "chat",
  // Re-split from "joy": romantic love gets its own icon now that one
  // exists; general happiness/gratitude stays under "joy".
  "heart",
  "mountain",
  "ocean",
  "rainbow",
  "tomato",
  "gimbap",
  "sushi",
  "bibimbap",
  "burger",
  "pizza",
  "salad",
  "default",
] as const;

export type StampId = (typeof STAMP_IDS)[number];

type Locale = "ja";

// Ordered: earlier categories win when multiple keywords match in the same
// entry. Weather goes first (explicit, rarely the *point* of an entry that
// also mentions something else). Specific, eventful categories come next —
// a day is more "calendar"/"work"/"travel" than it is "food" just because a
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
    { id: "cloud", words: ["曇り", "くもり"] },
    { id: "rainbow", words: ["虹"] },
    { id: "mountain", words: ["山"] },
    { id: "ocean", words: ["海"] },
    { id: "flower", words: ["花", "桜", "公園", "紅葉", "植物", "庭"] },
    { id: "celebration", words: ["誕生日", "お祝い", "記念日", "プレゼント"] },
    // An actual get-together (or a firm plan for one) reads as "calendar" —
    // a work drinking party counts too, it's still a specific plan/event,
    // not just friend small talk.
    { id: "calendar", words: ["会った", "約束", "飲み会"] },
    { id: "travel", words: ["旅行", "電車", "空港", "飛行機", "駅", "旅", "海外", "ホテル", "新幹線"] },
    { id: "shopping", words: ["買い物", "ショッピング", "デパート", "セール"] },
    { id: "exercise", words: ["運動", "走る", "ジム", "散歩", "筋トレ", "ヨガ", "水泳", "サッカー", "バスケ"] },
    { id: "music", words: ["音楽", "歌", "ライブ", "カラオケ", "コンサート", "バンド"] },
    { id: "movie", words: ["映画", "ドラマ", "映画館"] },
    { id: "book", words: ["本", "読書", "小説", "漫画", "図書館", "雑誌"] },
    { id: "cat", words: ["猫", "ペット", "動物"] },
    { id: "dog", words: ["犬"] },
    // Just naming a friend, without it being about a specific meetup or
    // plan (that's "calendar" above) — closer to mentioning them in
    // passing than the point of the entry.
    { id: "chat", words: ["友達", "友人"] },
    { id: "heart", words: ["恋"] },
    { id: "joy", words: ["好き", "嬉しい", "楽しい", "幸せ", "感謝"] },
    { id: "sad", words: ["悲しい", "泣", "辛い", "寂しい", "落ち込", "不安", "心配"] },
    { id: "study", words: ["勉強", "宿題", "テスト", "試験", "授業", "日本語", "留学"] },
    { id: "work", words: ["仕事", "会社", "残業", "会議", "出張", "上司", "同僚"] },
    { id: "sleep", words: ["眠い", "寝る", "寝坊", "布団", "疲れ", "寝不足"] },
    { id: "phone", words: ["電話", "メッセージ", "LINE"] },
    { id: "rest", words: ["休み", "のんびり", "ゆっくり", "リラックス"] },
    { id: "cook", words: ["自炊", "レシピ", "キッチン", "包丁"] },
    { id: "bread", words: ["パン", "ベーカリー"] },
    { id: "tomato", words: ["トマト"] },
    { id: "gimbap", words: ["キンパ"] },
    { id: "sushi", words: ["寿司", "すし"] },
    { id: "bibimbap", words: ["ビビンバ"] },
    { id: "burger", words: ["ハンバーガー"] },
    { id: "pizza", words: ["ピザ"] },
    { id: "salad", words: ["サラダ"] },
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
