import {
  decryptNullable,
  decryptString,
  encryptNullable,
  encryptString,
} from "@/lib/crypto/serverEncryption";
import type { DiaryParagraph, Suggestion } from "@/types/diary";

/**
 * The subset of a diary entry's fields that actually hold the learner's
 * own words — the diary text, the 添削 comments/corrections drawn from
 * it, and the overall comment. Everything else on a `DiaryEntry` (stamp
 * metadata, `readings` — the word/reading/meaning themselves — status,
 * timestamps) is left as plaintext; see README's "암호화" section for
 * why (readings alone don't reveal what a diary entry actually says, the
 * way a corrected sentence or the day's own text would).
 *
 * Field names deliberately match `DiaryEntry`'s own (snake_case
 * `overall_comment` included) so a `DiaryEntry`-shaped row can be sliced
 * into this and merged back with a plain object spread.
 */
export interface EncryptableEntryFields {
  content: string;
  overall_comment: string | null;
  suggestions: Suggestion[];
  paragraphs: DiaryParagraph[];
}

function mapSuggestions(suggestions: Suggestion[], fn: (s: string) => string): Suggestion[] {
  return suggestions.map((s) => ({
    original: fn(s.original),
    suggestion: fn(s.suggestion),
    note: fn(s.note),
  }));
}

function mapParagraphs(paragraphs: DiaryParagraph[], fn: (s: string) => string): DiaryParagraph[] {
  return paragraphs.map((p) => ({
    ...p,
    text: fn(p.text),
    comment: fn(p.comment),
    suggestions: mapSuggestions(p.suggestions, fn),
    // `readings` (the word/reading/meaning itself) stays plaintext, same
    // as the entry's own top-level `readings` — not part of this type.
  }));
}

export function encryptEntryFields(fields: EncryptableEntryFields): EncryptableEntryFields {
  return {
    content: encryptString(fields.content),
    overall_comment: encryptNullable(fields.overall_comment),
    suggestions: mapSuggestions(fields.suggestions, encryptString),
    paragraphs: mapParagraphs(fields.paragraphs, encryptString),
  };
}

export function decryptEntryFields(fields: EncryptableEntryFields): EncryptableEntryFields {
  return {
    content: decryptString(fields.content),
    overall_comment: decryptNullable(fields.overall_comment),
    suggestions: mapSuggestions(fields.suggestions, decryptString),
    paragraphs: mapParagraphs(fields.paragraphs, decryptString),
  };
}
