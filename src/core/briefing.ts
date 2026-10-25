import { CATEGORY_FOCUS, type CorrectionCategory } from "./model.ts";
import type { CorrectionRecord } from "./model.ts";
import { SESSION_BRIEFING_UTF8_BYTE_BUDGET } from "./protocol.ts";
import { computeStats, type PatternStat } from "./stats.ts";

const DEFAULT_LIMIT = 3;

export type Trend = "new" | "up" | "down" | "flat";

export interface Briefing {
  readonly total: number;
  readonly last7Days: number;
  readonly trend: Trend;
  readonly topPatterns: readonly PatternStat[];
  readonly focus: readonly CorrectionCategory[];
  readonly text: string;
}

// Build the session briefing: the main weaknesses, the 7-day trend and a
// suggested focus, capped to `limit` patterns to stay within the token budget
// (docs/architecture.md, "Context budget").
export function buildBriefing(records: readonly CorrectionRecord[], limit = DEFAULT_LIMIT, now?: Date): Briefing {
  const stats = computeStats(records, now);
  const topPatterns = stats.patterns.slice(0, limit);
  const focus = stats.byCategory.slice(0, limit).map((entry) => entry.category);
  const trend = resolveTrend(stats.total, stats.last7Days, stats.previous7Days);
  return {
    total: stats.total,
    last7Days: stats.last7Days,
    trend,
    topPatterns,
    focus,
    text: renderBriefing(stats.total, stats.last7Days, trend, topPatterns, focus),
  };
}

// The one-line focus for the per-message reminder, in English because the model
// is the reader.
export function focusLine(focus: readonly CorrectionCategory[]): string {
  if (focus.length === 0) {
    return "[fluentdev-br] Apply the correction protocol to this message.";
  }
  const phrases = focus.map((category) => CATEGORY_FOCUS[category]).join(", ");
  return `[fluentdev-br] Apply the correction protocol to this message. Focus: ${phrases}.`;
}

function resolveTrend(total: number, last7Days: number, previous7Days: number): Trend {
  if (total === 0) {
    return "new";
  }
  if (last7Days > previous7Days) {
    return "up";
  }
  if (last7Days < previous7Days) {
    return "down";
  }
  return "flat";
}

function renderBriefing(
  total: number,
  last7Days: number,
  trend: Trend,
  topPatterns: readonly PatternStat[],
  focus: readonly CorrectionCategory[],
): string {
  if (total === 0) {
    return "[fluentdev-br] No recorded mistakes yet. Corrections start once you write.";
  }
  const header = `[fluentdev-br] ${String(total)} mistakes recorded, ${String(last7Days)} in the last 7 days (${trend}).`;
  const focusText = focusLine(focus);
  const lines = [header];
  if (topPatterns.length > 0) {
    lines.push("Top patterns:");
    for (const pattern of topPatterns) {
      const line = `- [${pattern.category}] ${pattern.original} → ${pattern.correction} (${String(pattern.count)}x)`;
      const withoutPattern = [...lines, focusText].join("\n");
      const availableBytes = SESSION_BRIEFING_UTF8_BYTE_BUDGET - Buffer.byteLength(withoutPattern, "utf8") - 1;
      if (availableBytes <= 0) {
        break;
      }
      const fitted = fitUtf8(line, availableBytes);
      if (fitted.length === 0) {
        break;
      }
      lines.push(fitted);
      if (fitted !== line) {
        break;
      }
    }
  }
  lines.push(focusText);
  return fitUtf8(lines.join("\n"), SESSION_BRIEFING_UTF8_BYTE_BUDGET);
}

function fitUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return text;
  }
  const ellipsis = "…";
  const ellipsisBytes = Buffer.byteLength(ellipsis, "utf8");
  if (maxBytes < ellipsisBytes) {
    return "";
  }
  let fitted = "";
  let fittedBytes = ellipsisBytes;
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (fittedBytes + characterBytes > maxBytes) {
      break;
    }
    fitted += character;
    fittedBytes += characterBytes;
  }
  return `${fitted.trimEnd()}${ellipsis}`;
}
