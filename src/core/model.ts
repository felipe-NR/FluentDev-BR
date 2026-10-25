import { z } from "zod";
import { isSafeStoredIdentifier, isSafeStoredText } from "./privacy.ts";

// The maximum length of a stored fragment. Anything longer is a paste, a code
// block or a log line, not a short piece of prose to correct, so the store
// refuses it (docs/architecture.md, "Storage and privacy").
export const MAX_FRAGMENT_LENGTH = 160;

// Stable category IDs from the pt-BR profile
// (plugin/skills/fluentdev-br/references/l1-pt-br.md). Never rename an ID once
// mistakes are recorded against it; the statistics group on it.
export const CorrectionCategory = z.enum([
  "false-friend",
  "doubt-question",
  "preposition",
  "missing-subject",
  "there-be",
  "uncountable-plural",
  "article",
  "adjective-order",
  "verb-pattern",
  "tense-aspect",
  "question-form",
  "double-negative",
  "pronoun-gender",
  "capitalization",
  "spelling",
  "code-switching",
]);
export type CorrectionCategory = z.infer<typeof CorrectionCategory>;

// Where a correction came from: an end-of-turn hook capture or an MCP tool call.
export const CorrectionSource = z.enum(["hook", "tool"]);
export type CorrectionSource = z.infer<typeof CorrectionSource>;

const unsafeTextMessage = "must be a short prose fragment without prompts, code, or secret-shaped values";
const fragment = z.string().trim().min(1).max(MAX_FRAGMENT_LENGTH).refine(isSafeStoredText, unsafeTextMessage);
const reason = z
  .string()
  .trim()
  .max(MAX_FRAGMENT_LENGTH)
  .refine((value) => value === "" || isSafeStoredText(value), unsafeTextMessage);
const occurrenceId = z
  .string()
  .min(1)
  .max(128)
  .refine(isSafeStoredIdentifier, "must be an opaque identifier without secret-shaped values");

// The input a caller supplies for one correction. `occurrence_id` is present
// only when a hook reminder provided it; without it every call is a new
// occurrence (docs/architecture.md, "Capture").
export const CorrectionInput = z.object({
  original: fragment,
  correction: fragment,
  category: CorrectionCategory,
  reason,
  occurrence_id: occurrenceId.optional(),
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;

// One event in the append-only record. `mistake_key` groups statistics;
// `occurrence_id` preserves each legitimate repetition (docs/architecture.md,
// "Storage and privacy").
export const CorrectionRecord = z.object({
  id: z.uuid(),
  occurrence_id: occurrenceId.optional(),
  mistake_key: z.string(),
  ts: z.iso.datetime(),
  client: z.string().trim().min(1).max(64).refine(isSafeStoredIdentifier),
  category: CorrectionCategory,
  original: fragment,
  correction: fragment,
  reason,
  source: CorrectionSource,
}).refine(
  (record) => record.mistake_key === mistakeKey(record.category, record.original, record.correction),
  "mistake key must match the stored fragments",
);
export type CorrectionRecord = z.infer<typeof CorrectionRecord>;

// Short human focus phrases per category, used in the session briefing and the
// per-message reminder. Keeping the full set here means the compiler flags a
// category added without a phrase.
export const CATEGORY_FOCUS: Record<CorrectionCategory, string> = {
  "false-friend": "false friends (actually vs. currently)",
  "doubt-question": "question vs. doubt",
  preposition: "verb + preposition (depend on)",
  "missing-subject": "dummy subject (It is necessary)",
  "there-be": "there is / there are for existence",
  "uncountable-plural": "uncountable nouns (information)",
  article: "articles (a developer, Python is slow)",
  "adjective-order": "adjective before noun (the important files)",
  "verb-pattern": "verb patterns (explain to me, want you to)",
  "tense-aspect": "present perfect for duration (have worked since)",
  "question-form": "question form (Can you..., What does X mean)",
  "double-negative": "single negative (doesn't return anything)",
  "pronoun-gender": "its for objects (the function and its params)",
  capitalization: "capitals (English, Monday, I)",
  spelling: "spelling (success, environment)",
  "code-switching": "no Portuguese words mid-sentence",
};

// Collapse whitespace, trim and lowercase so that the same mistake written with
// different spacing or casing maps to one key.
function normalizeFragment(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// A stable key that groups repetitions of the same mistake for the statistics.
export function mistakeKey(category: CorrectionCategory, original: string, correction: string): string {
  return `${category}:${normalizeFragment(original)}→${normalizeFragment(correction)}`;
}
