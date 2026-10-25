import { mkdtemp, readFile, rm } from "node:fs/promises";
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
