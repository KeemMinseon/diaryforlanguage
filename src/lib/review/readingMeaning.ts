/** A reading's `meaning` should read like a plain dictionary gloss —
 * "일/직장", not a hedge about how confident the model was. Claude has
 * been observed appending its own uncertainty straight into the meaning
 * field itself when the source text looked like a typo/garbled compound
 * (e.g. "종관 제한(오타로 추정)" for a kanji run that probably wasn't a
 * real word) — visibly not a real gloss, and not something to display in
 * a word list meant to look like an actual dictionary.
 *
 * Used in two places: the review API route (`review-paragraph/route.ts`)
 * drops a reading matching this at save time, so it's never stored in the
 * first place; `collectWords.ts` filters it again at read time, so an
 * entry saved before this check existed doesn't keep showing up either.
 */
const UNCERTAIN_MEANING_RE = /오타|추정|불확실|확실(하지|치)\s*않|알\s*수\s*없/;

export function isUncertainMeaning(meaning: string): boolean {
  return UNCERTAIN_MEANING_RE.test(meaning);
}
