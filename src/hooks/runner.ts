import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { buildBriefing, focusLine } from "../core/briefing.ts";
import { readPreferences } from "../core/preferences.ts";
import { occurrenceId, parseCorrectionLines, SESSION_PROTOCOL } from "../core/protocol.ts";
import { claimOnce } from "../core/state.ts";
import { appendCorrection, readCorrections } from "../core/store.ts";
import * as antigravity from "./antigravity.ts";
import * as claudeCode from "./claude-code.ts";
import * as codex from "./codex.ts";
import { hooksDisabled } from "./gates.ts";
import { type ClientId, type HookEvent, type HookInput, type JsonValue } from "./types.ts";

type Parser = (event: HookEvent, raw: JsonValue) => HookInput | undefined | Promise<HookInput | undefined>;

const parsers: Record<ClientId, Parser> = {
  "claude-code": claudeCode.parse,
  codex: codex.parse,
  antigravity: antigravity.parse,
};

// Run one hook event and return the client's stdout. A hook never breaks a
// session: any internal error is logged and turns into empty output
// (docs/architecture.md, "CLI and hook rules").
export async function runHook(
  client: ClientId,
  event: HookEvent,
  payloadText: string,
  storeDir: string,
  now: Date = new Date(),
): Promise<string> {
  try {
    const raw = parsePayload(payloadText);
    if (raw === undefined) {
      return "";
    }
    const input = await parsers[client](event, raw);
    if (input === undefined) {
      return "";
    }

    const prefs = await readPreferences(storeDir);
    if (hooksDisabled(prefs, input.cwd, now)) {
      return "";
    }

    switch (event) {
      case "session-start":
        return await sessionStart(input, storeDir, prefs.briefing === "on", now);
      case "user-prompt-submit":
        return await userPromptSubmit(client, input, storeDir, now);
      case "stop":
        await stop(client, input, storeDir);
        return "";
    }
  } catch (error) {
    await logError(storeDir, client, event, error instanceof Error ? (error.stack ?? error.message) : String(error));
    return "";
  }
}

async function sessionStart(input: HookInput, storeDir: string, briefingOn: boolean, now: Date): Promise<string> {
  // Claude Code replays SessionStart on resume; the protocol is already in that
  // transcript, so re-injecting it would only cost tokens (docs/architecture.md,
  // "Correction protocol").
  if (input.source === "resume") {
    return "";
  }
  if (!briefingOn) {
    return SESSION_PROTOCOL;
  }
  const briefing = buildBriefing(await readCorrections(storeDir), undefined, now);
  return `${SESSION_PROTOCOL}\n\n${briefing.text}`;
}

async function userPromptSubmit(client: ClientId, input: HookInput, storeDir: string, now: Date): Promise<string> {
  const occurrence = occurrenceId(client, input.sessionId, input.turn);
  // One reminder per turn, even if two hook declarations fire. A client that
  // drops injected context after one model invocation gets it once per
  // invocation, with the same occurrence tag.
  const claim = input.invocation === undefined ? occurrence : `${occurrence}-${input.invocation}`;
  if (!(await claimOnce(storeDir, `reminder-${claim}`))) {
    return "";
  }
  const briefing = buildBriefing(await readCorrections(storeDir), undefined, now);
  return `${focusLine(briefing.focus)} [occ:${occurrence}]`;
}

async function stop(client: ClientId, input: HookInput, storeDir: string): Promise<void> {
  if (input.lastAssistantMessage === undefined) {
    return;
  }
  const occurrence = occurrenceId(client, input.sessionId, input.turn);
  for (const correction of parseCorrectionLines(input.lastAssistantMessage)) {
    await appendCorrection(storeDir, { ...correction, occurrence_id: occurrence }, { client, source: "hook" });
  }
}

function parsePayload(text: string): JsonValue | undefined {
  try {
    const result = z.json().safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

async function logError(storeDir: string, client: string, event: string, message: string): Promise<void> {
  try {
    const logDir = join(storeDir, "logs");
    await mkdir(logDir, { recursive: true });
    await appendFile(join(logDir, "hooks.log"), `${new Date().toISOString()} ${client}/${event} ${message}\n`, "utf8");
  } catch {
    // Nothing else to do; the hook must still exit 0 with empty output.
  }
}
