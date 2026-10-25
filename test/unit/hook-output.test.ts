import { describe, expect, it } from "vitest";
import { emptyHookOutput, formatHookOutput } from "../../src/hooks/output.ts";

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

  it("injects Antigravity SessionStart context as a system message", () => {
    expect(formatHookOutput("antigravity", "session-start", "Tutor context\nSecond line")).toBe(
      '{"injectSteps":[{"systemMessage":{"systemMessage":"Tutor context\\nSecond line"}}]}\n',
    );
  });

  it("injects Antigravity PreInvocation context as an ephemeral message", () => {
    expect(formatHookOutput("antigravity", "user-prompt-submit", "Apply the protocol.")).toBe(
      '{"injectSteps":[{"ephemeralMessage":"Apply the protocol."}]}\n',
    );
  });

  it("answers Antigravity with an empty JSON object when there is nothing to inject", () => {
    expect(formatHookOutput("antigravity", "session-start", "")).toBe("{}\n");
    expect(formatHookOutput("antigravity", "user-prompt-submit", "")).toBe("{}\n");
    expect(formatHookOutput("antigravity", "stop", "")).toBe("{}\n");
    expect(formatHookOutput("antigravity", "stop", "ignored")).toBe("{}\n");
  });
});

describe("emptyHookOutput", () => {
  it("is valid JSON for Antigravity and empty for the other clients", () => {
    expect(emptyHookOutput("antigravity")).toBe("{}\n");
    expect(emptyHookOutput("claude-code")).toBe("");
    expect(emptyHookOutput("codex")).toBe("");
  });
});
