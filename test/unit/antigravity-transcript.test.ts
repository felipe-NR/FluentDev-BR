import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findCurrentTurn, readCurrentTurn } from "../../src/hooks/antigravity-transcript.ts";

const createdDirectories: string[] = [];

function step(index: number, type: string, content?: string): string {
  return JSON.stringify(content === undefined ? { step_index: index, type } : { step_index: index, type, content });
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("findCurrentTurn", () => {
  it("returns the last user input and the model text after it", () => {
    const text = [
      step(0, "USER_INPUT", "first"),
      step(1, "PLANNER_RESPONSE", "old reply"),
      step(2, "USER_INPUT", "second"),
      step(3, "EPHEMERAL_MESSAGE", "hook context"),
      step(4, "PLANNER_RESPONSE"),
      step(5, "GENERIC", "tool output"),
      step(6, "PLANNER_RESPONSE", "part one"),
      step(7, "PLANNER_RESPONSE", "part two"),
      "",
    ].join("\n");
    expect(findCurrentTurn(text, true)).toEqual({ userInputStep: 2, assistantText: "part one\npart two" });
  });

  it("skips lines that are not transcript steps", () => {
    const text = [step(0, "USER_INPUT", "hi"), "plain text appended by the client", "{ broken", step(1, "PLANNER_RESPONSE", "ok")].join("\n");
    expect(findCurrentTurn(text, true)).toEqual({ userInputStep: 0, assistantText: "ok" });
  });

  it("ignores a possibly cut first line when the text starts mid-file", () => {
    expect(findCurrentTurn(step(9, "USER_INPUT", "cut"), false)).toBeUndefined();
  });
});

describe("readCurrentTurn", () => {
  it("finds the turn when the transcript spans several read chunks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fluentdev-br-transcript-"));
    createdDirectories.push(dir);
    const path = join(dir, "transcript_full.jsonl");
    const filler = "x".repeat(70 * 1024);
    const lines = [step(0, "USER_INPUT", "hi"), step(1, "GENERIC", filler), step(2, "PLANNER_RESPONSE", "done"), step(3, "GENERIC", filler)];
    await writeFile(path, `${lines.join("\n")}\n`, "utf8");
    expect(await readCurrentTurn(path)).toEqual({ userInputStep: 0, assistantText: "done" });
  });

  it("returns undefined when no user input is present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fluentdev-br-transcript-"));
    createdDirectories.push(dir);
    const path = join(dir, "transcript_full.jsonl");
    await writeFile(path, `${step(0, "SYSTEM_MESSAGE", "x")}\n`, "utf8");
    expect(await readCurrentTurn(path)).toBeUndefined();
  });
});
