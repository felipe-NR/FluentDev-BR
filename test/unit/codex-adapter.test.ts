import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateCodexAdapter } from "../../scripts/codex-adapter.ts";

const createdDirectories: string[] = [];

const McpConfig = z.object({
  mcpServers: z.object({
    "fluentdev-br": z.object({
      type: z.literal("stdio"),
      command: z.literal("node"),
      args: z.tuple([z.literal("dist/tutor.mjs"), z.literal("mcp")]),
      cwd: z.literal("."),
    }),
  }),
});

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("generateCodexAdapter", () => {
  it("launches its MCP server relative to the installed plugin root", async () => {
    const destination = await mkdtemp(join(tmpdir(), "fluentdev-br-codex-adapter-"));
    createdDirectories.push(destination);

    await generateCodexAdapter(destination);

    const config = McpConfig.parse(JSON.parse(await readFile(join(destination, ".mcp.json"), "utf8")));
    expect(config.mcpServers["fluentdev-br"]).toEqual({
      type: "stdio",
      command: "node",
      args: ["dist/tutor.mjs", "mcp"],
      cwd: ".",
    });
  });
});
