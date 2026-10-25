import { z } from "zod";
import { readCurrentTurn, type TranscriptTurn } from "./antigravity-transcript.ts";
import type { HookEvent, HookInput, JsonValue } from "./types.ts";

// Antigravity CLI payloads are camelCase protobuf JSON (S8, docs/compatibility.md).
// SessionStart fires once per new conversation, PreInvocation before every model
// invocation of a turn (`invocationNum` counts from 0), and Stop when the turn ends.
const Common = z.looseObject({
  conversationId: z.string().min(1),
  workspacePaths: z.array(z.string()).optional(),
  transcriptPath: z.string().optional(),
  lastUserInput: z.string().optional(),
});

const PreInvocation = Common.extend({ invocationNum: z.number().int().nonnegative() });
const Stop = Common.extend({ finalModelOutput: z.string().optional() });

type CommonPayload = z.infer<typeof Common>;

// Translate an Antigravity CLI hook payload into the normalized shape. The turn
// is the step index of the user input in the transcript, which the PreInvocation
// and Stop hooks of the same turn both see. Returns undefined for a payload that
// does not parse, so the runner emits the client's empty output.
export async function parse(event: HookEvent, raw: JsonValue): Promise<HookInput | undefined> {
  switch (event) {
    case "session-start": {
      const parsed = Common.safeParse(raw);
      if (!parsed.success) {
        return undefined;
      }
      return { event, sessionId: parsed.data.conversationId, turn: parsed.data.conversationId, cwd: workspace(parsed.data) };
    }
    case "user-prompt-submit": {
      const parsed = PreInvocation.safeParse(raw);
      if (!parsed.success) {
        return undefined;
      }
      const transcript = await currentTurn(parsed.data);
      const base = {
        event,
        sessionId: parsed.data.conversationId,
        turn: turnKey(parsed.data, transcript),
        cwd: workspace(parsed.data),
        invocation: String(parsed.data.invocationNum),
      };
      return parsed.data.lastUserInput === undefined ? base : { ...base, prompt: parsed.data.lastUserInput };
    }
    case "stop": {
      const parsed = Stop.safeParse(raw);
      if (!parsed.success) {
        return undefined;
      }
      const transcript = await currentTurn(parsed.data);
      const base = {
        event,
        sessionId: parsed.data.conversationId,
        turn: turnKey(parsed.data, transcript),
        cwd: workspace(parsed.data),
      };
      const message = nonEmpty(parsed.data.finalModelOutput) ?? nonEmpty(transcript?.assistantText);
      return message === undefined ? base : { ...base, lastAssistantMessage: message };
    }
  }
}

// The hook runs with the plugin directory as its working directory, so the
// project comes from the first workspace path.
function workspace(payload: CommonPayload): string {
  return payload.workspacePaths?.[0] ?? process.cwd();
}

async function currentTurn(payload: CommonPayload): Promise<TranscriptTurn | undefined> {
  if (payload.transcriptPath === undefined) {
    return undefined;
  }
  return readCurrentTurn(payload.transcriptPath).catch(() => undefined);
}

// Without a readable transcript, both hooks of a turn still see the same
// lastUserInput, so it keys the turn. occurrenceId hashes it and nothing stores it.
function turnKey(payload: CommonPayload, transcript: TranscriptTurn | undefined): string {
  if (transcript !== undefined) {
    return `step-${String(transcript.userInputStep)}`;
  }
  return `input-${payload.lastUserInput ?? ""}`;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}
