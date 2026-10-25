import { z } from "zod";

export type JsonValue = z.infer<ReturnType<typeof z.json>>;

export const ClientId = z.enum(["claude-code", "codex", "antigravity"]);
export type ClientId = z.infer<typeof ClientId>;

export const HookEvent = z.enum(["session-start", "user-prompt-submit", "stop"]);
export type HookEvent = z.infer<typeof HookEvent>;

// The fields the adapters read, normalized across clients. `turn` identifies the
// turn within the session; both the prompt and the stop payloads carry it, so
// the reminder and the end-of-turn capture derive the same occurrence id.
// `invocation` is set by clients that fire the prompt hook before every model
// invocation of a turn and drop the injected context after one invocation
// (Antigravity CLI): the reminder is emitted once per invocation instead.
export interface HookInput {
  readonly event: HookEvent;
  readonly sessionId: string;
  readonly turn: string;
  readonly cwd: string;
  readonly invocation?: string;
  readonly source?: string;
  readonly prompt?: string;
  readonly lastAssistantMessage?: string;
}

const base = z.looseObject({ session_id: z.string(), cwd: z.string() });

export const SessionStartPayload = base.extend({ source: z.string().optional() });
export const UserPromptPayload = base.extend({
  prompt: z.string(),
  prompt_id: z.string().optional(),
  turn_id: z.string().optional(),
});
export const StopPayload = base.extend({
  last_assistant_message: z.string().optional(),
  prompt_id: z.string().optional(),
  turn_id: z.string().optional(),
});
