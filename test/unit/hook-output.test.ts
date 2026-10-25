import { describe, expect, it } from "vitest";
import { formatHookOutput } from "../../src/hooks/output.ts";

describe("formatHookOutput", () => {
  it("wraps Codex SessionStart context in its validated JSON shape", () => {
    expect(formatHookOutput("codex", "session-start", "[fluentdev-br] Tutor context\nSecond line")).toBe(
      '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"[fluentdev-br] Tutor context\\nSecond line"}}\n',
    );
  });

  it("wraps Codex UserPromptSubmit context in its validated JSON shape", () => {
    expect(formatHookOutput("codex", "user-prompt-submit", "Apply the protocol.")).toBe(
      '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Apply the protocol."}}\n',
    );
  });

  it("keeps empty and non-context hook output unchanged", () => {
    expect(formatHookOutput("codex", "session-start", "")).toBe("");
    expect(formatHookOutput("codex", "stop", "stop output")).toBe("stop output");
    expect(formatHookOutput("claude-code", "session-start", "Tutor context")).toBe("Tutor context");
  });
});
