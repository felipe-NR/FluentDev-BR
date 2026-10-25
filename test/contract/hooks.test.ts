import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { readCorrections } from "../../src/core/store.ts";
import { runHook } from "../../src/hooks/runner.ts";
import type { ClientId, HookEvent } from "../../src/hooks/types.ts";

let dir = "";

const payloadObject = z.record(z.string(), z.json());

async function fixture(client: ClientId, event: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`./fixtures/${client}/${event}.json`, import.meta.url)), "utf8");
}

async function withField(client: ClientId, event: string, patch: Readonly<Record<string, string>>): Promise<string> {
  const parsed = payloadObject.parse(JSON.parse(await fixture(client, event)));
  return JSON.stringify({ ...parsed, ...patch });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "et-hooks-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const clients: readonly ClientId[] = ["claude-code", "codex"];

describe.each(clients)("hook adapter: %s", (client) => {
  it("injects the protocol on session start", async () => {
    const out = await runHook(client, "session-start", await fixture(client, "session-start"), dir);
    expect(out).toContain("[fluentdev-br] Act as my English tutor");
    expect(out).toContain('"original" → "correction"');
  });

  it("stays silent on a resumed session", async () => {
    const payload = await withField(client, "session-start", { source: "resume" });
    expect(await runHook(client, "session-start", payload, dir)).toBe("");
  });

  it("emits the reminder once per turn", async () => {
    const payload = await fixture(client, "user-prompt-submit");
    const first = await runHook(client, "user-prompt-submit", payload, dir);
    const second = await runHook(client, "user-prompt-submit", payload, dir);
    expect(first).toContain("[fluentdev-br] Apply the correction protocol");
    expect(first).toContain("[occ:");
    expect(second).toBe("");
  });

  it("captures corrections from the final message on stop", async () => {
    const message = '✏️ [preposition] "it depends of the env" → "it depends on the env" (depend takes on)\nDone.';
    const payload = await withField(client, "stop", { last_assistant_message: message });
    const out = await runHook(client, "stop", payload, dir);
    expect(out).toBe("");
    const records = await readCorrections(dir);
    expect(records).toHaveLength(1);
    expect(records[0]?.category).toBe("preposition");
    expect(records[0]?.source).toBe("hook");
  });

  it("does not double-store the same occurrence captured twice", async () => {
    const message = '✏️ [spelling] "enviroment" → "environment" (spelling)';
    const payload = await withField(client, "stop", { last_assistant_message: message });
    await runHook(client, "stop", payload, dir);
    await runHook(client, "stop", payload, dir);
    expect(await readCorrections(dir)).toHaveLength(1);
  });

  it("returns empty output for a malformed payload without throwing", async () => {
    expect(await runHook(client, "user-prompt-submit", "{ not json", dir)).toBe("");
    expect(await runHook(client, "stop", "{}", dir)).toBe("");
  });
});

describe("hook adapter: antigravity", () => {
  const transcriptFixture = fileURLToPath(new URL("./fixtures/antigravity/transcript_full.jsonl", import.meta.url));

  // Point the recorded payload at a transcript the test controls.
  async function payload(event: string, transcriptPath: string = transcriptFixture): Promise<string> {
    return withField("antigravity", event, { transcriptPath });
  }

  async function transcriptWith(reply: string): Promise<string> {
    const lines = (await readFile(transcriptFixture, "utf8")).trimEnd().split("\n");
    const last = payloadObject.parse(JSON.parse(lines.at(-1) ?? "{}"));
    lines[lines.length - 1] = JSON.stringify({ ...last, content: reply });
    const path = join(dir, "transcript_full.jsonl");
    await writeFile(path, `${lines.join("\n")}\n`, "utf8");
    return path;
  }

  it("injects the protocol on session start", async () => {
    const out = await runHook("antigravity", "session-start", await fixture("antigravity", "session-start"), dir);
    expect(out).toContain("[fluentdev-br] Act as my English tutor");
  });

  it("emits the reminder once per model invocation with one occurrence per turn", async () => {
    const first = await runHook("antigravity", "user-prompt-submit", await payload("user-prompt-submit"), dir);
    const repeat = await runHook("antigravity", "user-prompt-submit", await payload("user-prompt-submit"), dir);
    const loop = await runHook("antigravity", "user-prompt-submit", await payload("user-prompt-submit-tool-loop"), dir);
    expect(first).toContain("[fluentdev-br] Apply the correction protocol");
    expect(repeat).toBe("");
    expect(loop).toContain("[fluentdev-br] Apply the correction protocol");
    const occTag = /\[occ:[0-9a-f]+\]/;
    expect(occTag.exec(loop)?.[0]).toBe(occTag.exec(first)?.[0]);
  });

  it("keys the turn by lastUserInput when the transcript is unreadable", async () => {
    const missing = join(dir, "missing.jsonl");
    const first = await runHook("antigravity", "user-prompt-submit", await payload("user-prompt-submit", missing), dir);
    expect(first).toContain("[occ:");
  });

  it("captures corrections from the transcript on stop with the reminder's occurrence", async () => {
    const message = '✏️ [preposition] "it depends of the env" → "it depends on the env" (depend takes on)\nDone.';
    const path = await transcriptWith(message);
    const reminder = await runHook("antigravity", "user-prompt-submit", await payload("user-prompt-submit", path), dir);
    const out = await runHook("antigravity", "stop", await payload("stop", path), dir);
    expect(out).toBe("");
    const records = await readCorrections(dir);
    expect(records).toHaveLength(1);
    expect(records[0]?.category).toBe("preposition");
    expect(records[0]?.source).toBe("hook");
    expect(reminder).toContain(`[occ:${records[0]?.occurrence_id ?? "missing"}]`);
  });

  it("prefers finalModelOutput when the client sends it", async () => {
    const message = '✏️ [spelling] "enviroment" → "environment" (spelling)';
    const raw = payloadObject.parse(JSON.parse(await payload("stop")));
    await runHook("antigravity", "stop", JSON.stringify({ ...raw, finalModelOutput: message }), dir);
    await runHook("antigravity", "stop", JSON.stringify({ ...raw, finalModelOutput: message }), dir);
    expect(await readCorrections(dir)).toHaveLength(1);
  });

  it("returns empty output for a malformed payload without throwing", async () => {
    expect(await runHook("antigravity", "user-prompt-submit", "{ not json", dir)).toBe("");
    expect(await runHook("antigravity", "stop", "{}", dir)).toBe("");
  });
});

describe("kill switch", () => {
  const previous = process.env["FLUENTDEV_BR_DISABLE"];
  afterEach(() => {
    if (previous === undefined) {
      delete process.env["FLUENTDEV_BR_DISABLE"];
    } else {
      process.env["FLUENTDEV_BR_DISABLE"] = previous;
    }
  });

  it("silences every hook when set", async () => {
    process.env["FLUENTDEV_BR_DISABLE"] = "1";
    const events: readonly HookEvent[] = ["session-start", "user-prompt-submit", "stop"];
    for (const event of events) {
      expect(await runHook("claude-code", event, await fixture("claude-code", event), dir)).toBe("");
    }
  });
});
