import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const bundle = fileURLToPath(new URL("../../plugin/dist/tutor.mjs", import.meta.url));

// The MCP results cross a process boundary, so read them through schemas rather
// than trusting the transported shape.
const toolResult = z.object({
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
  isError: z.boolean().optional(),
});
const resourceResult = z.object({
  contents: z.array(z.looseObject({ text: z.string().optional() })),
});

let store = "";
let client: Client;

async function callTool(pending: ReturnType<Client["callTool"]>): Promise<z.infer<typeof toolResult>> {
  return toolResult.parse(await pending);
}

function toolText(result: z.infer<typeof toolResult>): string {
  return result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
}

beforeAll(async () => {
  store = await mkdtemp(join(tmpdir(), "et-mcp-"));
  client = new Client({ name: "test", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [bundle, "mcp"],
      env: { ...process.env, FLUENTDEV_BR_DATA: store },
    }),
  );
});

afterAll(async () => {
  await client.close();
  await rm(store, { recursive: true, force: true });
});

describe("fluentdev-br MCP server", () => {
  it("exposes the tools, prompts and resources from the plan", async () => {
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
    expect(tools).toEqual(["get_briefing", "get_report", "purge_history", "record_corrections", "set_preferences"]);
    const prompts = (await client.listPrompts()).prompts.map((prompt) => prompt.name).sort();
    expect(prompts).toEqual(["english-report", "english-review", "fluentdev-br-on"]);
    const resources = (await client.listResources()).resources.map((resource) => resource.uri).sort();
    expect(resources).toEqual(["fluentdev-br://profile/pt-BR", "fluentdev-br://protocol", "fluentdev-br://report"]);
  });

  it("records valid corrections and skips a fragment over the limit", async () => {
    const result = await callTool(
      client.callTool({
        name: "record_corrections",
        arguments: {
          corrections: [
            { original: "it depends of the env", correction: "it depends on the env", category: "preposition", reason: "on" },
            { original: "x".repeat(200), correction: "y", category: "spelling", reason: "long" },
          ],
        },
      }),
    );
    expect(toolText(result)).toContain("Recorded 1");
    expect(toolText(result)).toContain("skipped 1");
  });

  it("returns a briefing built from the recorded corrections", async () => {
    const result = await callTool(client.callTool({ name: "get_briefing", arguments: {} }));
    expect(toolText(result)).toContain("[fluentdev-br]");
    expect(toolText(result)).toContain("preposition");
  });

  it("returns a Markdown report", async () => {
    const result = await callTool(client.callTool({ name: "get_report", arguments: { period: "all" } }));
    expect(toolText(result)).toContain("## Pattern Tracking");
  });

  it("updates preferences", async () => {
    const result = await callTool(client.callTool({ name: "set_preferences", arguments: { strictness: "strict" } }));
    expect(toolText(result)).toContain("strict");
  });

  it("serves the protocol resource from the skill references", async () => {
    const result = resourceResult.parse(await client.readResource({ uri: "fluentdev-br://protocol" }));
    const text = result.contents.map((entry) => entry.text ?? "").join("\n");
    expect(text).toContain("Correction protocol");
  });

  it("refuses to purge without confirmation and purges with it", async () => {
    const refused = await callTool(client.callTool({ name: "purge_history", arguments: { confirm: false, all: true } }));
    expect(refused.isError).toBe(true);
    const purged = await callTool(client.callTool({ name: "purge_history", arguments: { confirm: true, all: true } }));
    expect(toolText(purged)).toContain("Removed");
  });
});
