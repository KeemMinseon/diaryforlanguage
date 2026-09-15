/**
 * Deterministic keyword → stamp matching.
 *
 * When a diary entry has no photo, we pick a stamp motif by scanning the
 * entry text for target-language keywords. This runs entirely client-side
 * (no AI call) so the stamp appears the instant the entry is saved.
 *
 * To support another target language later, add a new key to
 * `KEYWORD_RULES` (e.g. "ko", "en") with the same category ids used by
 * `STAMP_IDS` — the rest of the stamp UI is language-agnostic.
 *
 * This 151-keyword set replaced the previous smaller 38-keyword one in one
 * pass, matched against a real set of prepared stamp images (see
 * stampVariants.ts) — the Japanese trigger words below are a first draft
 * translated directly from each keyword's own meaning, not vocabulary
 * tested against real diary entries yet, so treat them as a starting point
 * to refine rather than a finished set. "cry" was folded into "sad" rather
 * than kept as its own category (no dedicated cry-* images) — its two
 * trigger words ("泣", "涙") moved into sad's own word list.
 */

export const STAMP_IDS = [
  "rain",
  "snow",
  "sunny",
  "cloudy",
  "wind",
  "breeze",
  "rainbow",
  "sky",
  "star",
  "moon",
  "dawn",
  "sunset",
  "midnight",
  "spring",
  "summer",
  "autumn",
  "winter",
  "season",
  "sun",
  "birthday",
  "xmas",
  "appointment",
  "goodbye",
  "hello",
  "breakup",
  "serendipity",
  "longing",
  "loneliness",
  "gratitude",
  "hope",
  "wish",
  "peace",
  "comfort",
  "fear",
  "anxiety",
  "sick",
  "romance",
  "queer",
  "airport",
  "flight",
  "passport",
  "ticket",
  "suitcase",
  "hotel",
  "map",
  "journey",
  "vacation",
  "travel",
  "japan",
  "korea",
  "china",
  "vietnam",
  "seoul",
  "busan",
  "daejeon",
  "gwangju",
  "jeonju",
  "gyeongju",
  "jeju",
  "tokyo",
  "osaka",
  "kyoto",
  "train",
  "mountain",
  "ocean",
  "river",
  "lake",
  "forest",
  "tree",
  "flower",
  "rose",
  "garden",
  "park",
  "beach",
  "city",
  "home",
  "school",
  "cat",
  "dog",
  "bird",
  "rabbit",
  "butterfly",
  "breakfast",
  "lunch",
  "dinner",
  "kfood",
  "hamburger",
  "pizza",
  "sushi",
  "salad",
  "friedchicken",
  "icecream",
  "bread",
  "cake",
  "dessert",
  "snack",
  "tea",
  "wine",
  "beer",
  "hiking",
  "running",
  "workout",
  "yoga",
  "soccer",
  "football",
  "basketball",
  "dance",
  "game",
  "music",
  "sing",
  "read",
  "book",
  "study",
  "writing",
  "poetry",
  "knitting",
  "drive",
  "walk",
  "picnic",
  "cleaning",
  "cook",
  "recipe",
  "shopping",
  "family",
  "lover",
  "friendship",
  "together",
  "date",
  "chat",
  "joy",
  "happiness",
  "sad",
  "memories",
  "dream",
  "morning",
  "afternoon",
  "evening",
  "nap",
  "sleep",
  "rest",
  "phone",
  "calendar",
  "routine",
  "youth",
  "work",
  "weekend",
  "movie",
  "engraving",
  "food",
  "coffee",
  "cafe",
  "default",
] as const;

export type StampId = (typeof STAMP_IDS)[number];

/** Every keyword id in KEYWORD_RULES' own "── 음식 (food) ──" tier below —
 * kept as an explicit, exported list (rather than derived from that
 * comment, which isn't a real data structure) so 우표 모음 (see
 * collectStamps.ts) can merge them into one "how many different kinds"
 * summary instead of a long tail of individual small counts. Keep this in
 * sync with that tier if a food keyword is ever added, renamed, or moved
 * out of it.
 * FOOD_STAMP_IDS 값을 바꿀 때 아래 KEYWORD_RULES의 "음식" tier도 함께 확인. */
export const FOOD_STAMP_IDS: StampId[] = [
  "breakfast",
  "lunch",
  "dinner",
  "kfood",
  "hamburger",
  "pizza",
  "sushi",
  "salad",
  "friedchicken",
  "icecream",
  "bread",
  "cake",
  "dessert",
  "snack",
  "tea",
  "wine",
  "beer",
  "food",
  "coffee",
  "cafe",
];

/** One category's own label + every keyword id in it — for 우표 모음's
 * "수집우표" tab, which groups collected keyword stamps by category rather
 * than listing all 151 keywords flat. Mirrors KEYWORD_RULES' own tier
 * boundaries below (same "── 라벨 ──" sections) as a real, importable data
 * structure, since those are just comments in an array literal. Keep this
 * in sync with KEYWORD_RULES if a tier's boundary ever moves — an id added,
 * renamed, or moved between tiers there needs the same change here.
 * "default" (그 밖의 하루, pickStamp's own fallback) isn't part of any real
 * tier, so it gets its own single-id "기타" category instead. */
export interface KeywordCategory {
  label: string;
  ids: StampId[];
}

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    label: "감정",
    ids: [
      "birthday", "xmas", "appointment", "goodbye", "hello", "breakup",
      "serendipity", "longing", "loneliness", "gratitude", "hope", "wish",
      "peace", "comfort", "fear", "anxiety", "joy", "happiness", "sad",
      "memories", "dream", "sick", "romance", "queer",
    ],
  },
  {
    label: "활동",
    ids: [
      "hiking", "running", "workout", "yoga", "soccer", "football",
      "basketball", "dance", "game", "music", "sing", "read", "book",
      "study", "writing", "poetry", "knitting", "drive", "walk", "picnic",
      "cleaning", "cook", "recipe", "shopping",
    ],
  },
  { label: "관계", ids: ["family", "lover", "friendship", "together", "date", "chat"] },
  {
    label: "여행",
    ids: [
      "airport", "flight", "passport", "ticket", "suitcase", "hotel", "map",
      "journey", "vacation", "travel", "japan", "korea", "china", "vietnam",
      "seoul", "busan", "daejeon", "gwangju", "jeonju", "gyeongju", "jeju",
      "tokyo", "osaka", "kyoto", "train",
    ],
  },
  {
    label: "장소",
    ids: [
      "mountain", "ocean", "river", "lake", "forest", "tree", "flower",
      "rose", "garden", "park", "beach", "city", "home", "school",
    ],
  },
  {
    label: "일상",
    ids: [
      "morning", "afternoon", "evening", "nap", "sleep", "rest", "phone",
      "calendar", "routine", "youth", "work", "weekend", "movie", "engraving",
    ],
  },
  {
    label: "날씨",
    ids: [
      "rain", "snow", "sunny", "cloudy", "wind", "breeze", "rainbow", "sky",
      "star", "moon", "dawn", "sunset", "midnight", "spring", "summer",
      "autumn", "winter", "season", "sun",
    ],
  },
  { label: "음식", ids: FOOD_STAMP_IDS },
  { label: "동물", ids: ["cat", "dog", "bird", "rabbit", "butterfly"] },
  { label: "기타", ids: ["default"] },
];

type Locale = "ja";

// Ordered: earlier categories win when multiple keywords match in the same
// entry. Tiered by how much an entry mentioning that tier is actually
// *about* it, most to least: emotions/occasions (what the entry is really
// about, if anything is) — activities/hobbies, relationships, travel,
// nature/places (what the day actually consisted of) — daily-life odds and
// ends, weather/season (background/scene-setting, rarely the entry's own
// point) — food, animals (almost every entry mentions eating *something*,
// or a pet in passing, incidentally, so either matching shouldn't outrank
// whatever the entry was actually about).
const KEYWORD_RULES: Record<Locale, Array<{ id: StampId; words: string[] }>> = {
  ja: [
    // ── 감정/기념일 (emotion/occasions) — 최우선 tier ────────────────────
    // "joy"/"happiness"/"sad"/"memories"/"dream" used to sit much further
    // down (after travel, nature, animals, specific foods, activities, and
    // relationships) — a second, stray emotion tier separate from this
    // one, left over from however these categories were added over time.
    // Moved in here with the rest, so any emotion word — not just the ones
    // that happened to land in this first tier — outranks an activity or a
    // meal mentioned alongside it. See KEYWORD_RULES' own doc comment above
    // for the full tier order this and every other "── ... ──" header below
    // is part of.
    { id: "birthday", words: ["誕生日", "バースデー"] },
    { id: "xmas", words: ["クリスマス"] },
    { id: "appointment", words: ["約束", "予定"] },
    { id: "goodbye", words: ["さようなら", "別れ"] },
    { id: "hello", words: ["こんにちは", "挨拶"] },
    { id: "breakup", words: ["別れ話", "失恋"] },
    { id: "serendipity", words: ["偶然の出会い", "運命的"] },
    // Same past-tense/conjugation gap as "sad" (see its own comment below)
    // — these four are all i-adjectives, trimmed to their shared stem so
    // "恋しかった"/"懐かしかった"/"寂しかった"/"怖かった" (all ordinary
    // past-tense diary phrasing) match, not just the dictionary form.
    { id: "longing", words: ["恋し", "懐かし"] },
    { id: "loneliness", words: ["寂し", "孤独"] },
    { id: "gratitude", words: ["感謝"] },
    { id: "hope", words: ["希望"] },
    { id: "wish", words: ["願い", "願う"] },
    { id: "peace", words: ["平和", "穏やか"] },
    { id: "comfort", words: ["癒し", "安心"] },
    // "不安" used to be listed under both "fear" and "anxiety" — since
    // "fear" comes first, every "不安" entry matched "fear" and
    // "anxiety"'s own copy of that same word could never actually be
    // reached (only "心配" could ever land there). "不安" (unease/anxious)
    // fits "anxiety" better than "fear" (怖い, a reaction to something
    // actually scary) anyway, so it moved rather than staying duplicated.
    { id: "fear", words: ["怖"] },
    { id: "anxiety", words: ["不安", "心配"] },
    // "嬉しい"/"楽しい" are i-adjectives too — same stem trim as "longing"/
    // "loneliness"/"fear" above ("幸せ" is a na-adjective/noun, so its own
    // ending never changes and needed no fix).
    { id: "joy", words: ["嬉し", "楽し", "幸せ"] },
    { id: "happiness", words: ["幸福"] },
    // "悲しい" (dictionary form) missed a diary entry that was written in
    // past tense ("悲しかった") — an i-adjective's ending changes with
    // conjugation, so matching only the dictionary form misses every past-
    // tense/negative/etc. entry, which for a diary (almost always written
    // about something already over) is the common case, not the rare one.
    // Trimmed to the shared stem "悲し", the same way "落ち込" already
    // avoids this by not including 落ち込む's own ending.
    { id: "sad", words: ["悲し", "辛い", "落ち込", "泣", "涙"] },
    { id: "memories", words: ["思い出"] },
    { id: "dream", words: ["夢"] },
    { id: "sick", words: ["体調不良", "風邪", "病院"] },
    { id: "romance", words: ["恋愛", "ロマンス"] },
    { id: "queer", words: ["クィア", "性的少数者"] },

    // ── 활동/취미 (activities/hobbies) ──────────────────────────────────
    // Moved up ahead of travel/nature/animals/food — an entry that's
    // fundamentally about an activity shouldn't lose to an incidental meal
    // or scenery mention along the way, the same reasoning "food"/"coffee"/
    // "cafe" already get placed dead last for.
    { id: "hiking", words: ["ハイキング", "山登り"] },
    { id: "running", words: ["ランニング", "走る"] },
    { id: "workout", words: ["筋トレ", "トレーニング"] },
    { id: "yoga", words: ["ヨガ"] },
    { id: "soccer", words: ["サッカー"] },
    { id: "football", words: ["アメフト"] },
    { id: "basketball", words: ["バスケ", "バスケットボール"] },
    { id: "dance", words: ["ダンス", "踊り"] },
    { id: "game", words: ["ゲーム"] },
    { id: "music", words: ["音楽", "歌", "ライブ", "バンド"] },
    { id: "sing", words: ["歌う", "カラオケ"] },
    { id: "read", words: ["読書", "本を読む"] },
    { id: "book", words: ["本", "小説", "図書館", "雑誌"] },
    { id: "study", words: ["勉強", "宿題", "テスト", "試験", "日本語"] },
    { id: "writing", words: ["文章を書く", "日記を書く"] },
    { id: "poetry", words: ["詩"] },
    { id: "knitting", words: ["編み物"] },
    { id: "drive", words: ["ドライブ"] },
    { id: "walk", words: ["散歩"] },
    { id: "picnic", words: ["ピクニック"] },
    { id: "cleaning", words: ["掃除"] },
    { id: "cook", words: ["自炊", "料理", "キッチン"] },
    { id: "recipe", words: ["レシピ"] },
    { id: "shopping", words: ["買い物", "ショッピング", "デパート", "セール"] },

    // ── 관계 (relationships) ────────────────────────────────────────────
    { id: "family", words: ["家族"] },
    { id: "lover", words: ["恋人", "彼氏", "彼女"] },
    { id: "friendship", words: ["友情", "友達"] },
    { id: "together", words: ["一緒に"] },
    { id: "date", words: ["デート"] },
    { id: "chat", words: ["おしゃべり", "雑談"] },

    // ── 여행 (travel) ───────────────────────────────────────────────────
    { id: "airport", words: ["空港"] },
    { id: "flight", words: ["飛行機", "フライト"] },
    { id: "passport", words: ["パスポート", "旅券"] },
    { id: "ticket", words: ["チケット", "切符"] },
    { id: "suitcase", words: ["スーツケース", "荷物"] },
    { id: "hotel", words: ["ホテル"] },
    { id: "map", words: ["地図"] },
    { id: "journey", words: ["旅路", "道のり"] },
    { id: "vacation", words: ["休暇", "バケーション"] },
    { id: "travel", words: ["旅行", "旅", "海外"] },
    { id: "japan", words: ["日本"] },
    { id: "korea", words: ["韓国"] },
    { id: "china", words: ["中国"] },
    { id: "vietnam", words: ["ベトナム"] },
    { id: "seoul", words: ["ソウル"] },
    { id: "busan", words: ["釜山", "プサン"] },
    { id: "daejeon", words: ["大田", "テジョン"] },
    { id: "gwangju", words: ["光州", "クァンジュ"] },
    { id: "jeonju", words: ["全州", "チョンジュ"] },
    { id: "gyeongju", words: ["慶州", "キョンジュ"] },
    { id: "jeju", words: ["済州", "チェジュ"] },
    { id: "tokyo", words: ["東京"] },
    { id: "osaka", words: ["大阪"] },
    { id: "kyoto", words: ["京都"] },
    { id: "train", words: ["電車", "新幹線", "駅"] },

    // ── 자연/장소 (nature/places) ───────────────────────────────────────
    { id: "mountain", words: ["山", "登山"] },
    { id: "ocean", words: ["海"] },
    { id: "river", words: ["川"] },
    { id: "lake", words: ["湖"] },
    { id: "forest", words: ["森"] },
    { id: "tree", words: ["木"] },
    { id: "flower", words: ["花", "桜"] },
    { id: "rose", words: ["バラ"] },
    { id: "garden", words: ["庭", "花畑"] },
    { id: "park", words: ["公園"] },
    { id: "beach", words: ["ビーチ", "浜辺"] },
    { id: "city", words: ["街", "都市"] },
    { id: "home", words: ["家", "自宅"] },
    { id: "school", words: ["学校", "授業"] },

    // ── 일상/시간 (daily life/time) ─────────────────────────────────────
    { id: "morning", words: ["朝"] },
    { id: "afternoon", words: ["午後"] },
    { id: "evening", words: ["夕方", "夜"] },
    { id: "nap", words: ["昼寝"] },
    { id: "sleep", words: ["眠い", "寝る", "寝坊", "疲れ", "寝不足"] },
    { id: "rest", words: ["休み", "のんびり", "ゆっくり"] },
    { id: "phone", words: ["電話", "メッセージ"] },
    { id: "calendar", words: ["予定表", "スケジュール"] },
    { id: "routine", words: ["日課", "ルーティン"] },
    { id: "youth", words: ["青春"] },
    { id: "work", words: ["仕事", "会社", "残業", "会議", "上司", "同僚"] },
    { id: "weekend", words: ["週末"] },
    { id: "movie", words: ["映画", "ドラマ", "映画館"] },
    { id: "engraving", words: ["刻む", "彫刻"] },

    // ── 날씨/계절 (weather/season) ──────────────────────────────────────
    { id: "rain", words: ["雨", "梅雨", "傘", "台風"] },
    { id: "snow", words: ["雪", "雪だるま"] },
    { id: "sunny", words: ["晴れ", "快晴"] },
    { id: "cloudy", words: ["曇り", "くもり"] },
    { id: "wind", words: ["風"] },
    { id: "breeze", words: ["そよ風"] },
    { id: "rainbow", words: ["虹"] },
    { id: "sky", words: ["空", "青空"] },
    { id: "star", words: ["星"] },
    { id: "moon", words: ["月"] },
    { id: "dawn", words: ["夜明け", "明け方"] },
    { id: "sunset", words: ["夕焼け", "夕日"] },
    { id: "midnight", words: ["真夜中", "深夜"] },
    { id: "spring", words: ["春"] },
    { id: "summer", words: ["夏"] },
    { id: "autumn", words: ["秋", "紅葉"] },
    { id: "winter", words: ["冬"] },
    { id: "season", words: ["季節"] },
    { id: "sun", words: ["太陽", "日差し", "暑い", "猛暑"] },

    // ── 음식 (food) — 가장 뒤쪽 두 tier 중 앞 ────────────────────────────
    // 거의 모든 일기가 뭔가를 먹었다는 얘기를 지나가듯 언급하니, 음식이
    // 먼저 걸리면 정작 그 날의 진짜 내용(감정, 활동)을 가려버린다.
    { id: "breakfast", words: ["朝食", "朝ごはん"] },
    { id: "lunch", words: ["昼食", "ランチ"] },
    { id: "dinner", words: ["夕食", "晩ごはん"] },
    { id: "kfood", words: ["韓国料理", "キムチ"] },
    { id: "hamburger", words: ["ハンバーガー"] },
    { id: "pizza", words: ["ピザ"] },
    { id: "sushi", words: ["寿司", "すし"] },
    { id: "salad", words: ["サラダ"] },
    { id: "friedchicken", words: ["フライドチキン", "チキン"] },
    { id: "icecream", words: ["アイスクリーム", "アイス"] },
    { id: "bread", words: ["パン", "ベーカリー"] },
    { id: "cake", words: ["ケーキ"] },
    { id: "dessert", words: ["デザート", "スイーツ"] },
    { id: "snack", words: ["おやつ", "スナック"] },
    { id: "tea", words: ["紅茶", "お茶"] },
    { id: "wine", words: ["ワイン"] },
    { id: "beer", words: ["ビール"] },
    { id: "food", words: ["ご飯", "食べ", "レストラン", "居酒屋"] },
    { id: "coffee", words: ["コーヒー"] },
    { id: "cafe", words: ["カフェ"] },

    // ── 동물 (animals) — 가장 마지막 ─────────────────────────────────────
    { id: "cat", words: ["猫", "ペット"] },
    { id: "dog", words: ["犬"] },
    { id: "bird", words: ["鳥"] },
    { id: "rabbit", words: ["うさぎ"] },
    { id: "butterfly", words: ["蝶"] },
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
