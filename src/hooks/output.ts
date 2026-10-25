import type { ClientId, HookEvent } from "./types.ts";

// The portable hook runner returns context text. Codex 0.154 validates
// non-empty SessionStart and UserPromptSubmit stdout as event-specific JSON,
// and the Antigravity CLI parses every hook's stdout as protobuf JSON, so
// serialize that text only at the client boundary.
export function formatHookOutput(client: ClientId, event: HookEvent, context: string): string {
  switch (client) {
    case "claude-code":
      return context;
    case "codex":
      return codexOutput(event, context);
    case "antigravity":
      return antigravityOutput(event, context);
  }
}

// What a client receives when the hook has nothing to say, including after an
// internal error or an unknown event (docs/architecture.md, "CLI and hook rules").
export function emptyHookOutput(client: ClientId): string {
  return client === "antigravity" ? "{}\n" : "";
}

function codexOutput(event: HookEvent, context: string): string {
  if (context === "") {
    return context;
  }
  const hookEventName = codexContextEventName(event);
  if (hookEventName === undefined) {
    return context;
  }
  return `${JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext: context } })}\n`;
}

function codexContextEventName(event: HookEvent): "SessionStart" | "UserPromptSubmit" | undefined {
  switch (event) {
    case "session-start":
      return "SessionStart";
    case "user-prompt-submit":
      return "UserPromptSubmit";
    case "stop":
      return undefined;
  }
}

// SessionStart injects a system message, which stays in the conversation.
// PreInvocation injects an ephemeral message, which the model sees for that one
// invocation only (S8). Stop has no context to inject.
function antigravityOutput(event: HookEvent, context: string): string {
  if (context === "") {
    return emptyHookOutput("antigravity");
  }
  switch (event) {
    case "session-start":
      return `${JSON.stringify({ injectSteps: [{ systemMessage: { systemMessage: context } }] })}\n`;
    case "user-prompt-submit":
      return `${JSON.stringify({ injectSteps: [{ ephemeralMessage: context }] })}\n`;
    case "stop":
      return emptyHookOutput("antigravity");
  }
}
