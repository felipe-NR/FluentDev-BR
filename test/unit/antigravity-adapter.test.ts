import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateAntigravityAdapter } from "../../scripts/antigravity-adapter.ts";

const createdDirectories: string[] = [];

const Hook = z.tuple([z.object({ command: z.string(), timeout: z.literal(30) })]);
const HooksFile = z.strictObject({
  "fluentdev-br": z.strictObject({ SessionStart: Hook, PreInvocation: Hook, Stop: Hook }),
});
const McpConfig = z.strictObject({
  mcpServers: z.strictObject({
    "fluentdev-br": z.strictObject({ command: z.literal("node"), args: z.tuple([z.literal("dist/tutor.mjs"), z.literal("mcp")]) }),
  }),
});
const Manifest = z.strictObject({ name: z.literal("fluentdev-br"), version: z.string(), description: z.string() });

async function generate(): Promise<string> {
  const destination = await mkdtemp(join(tmpdir(), "fluentdev-br-antigravity-adapter-"));
  createdDirectories.push(destination);
  await generateAntigravityAdapter(destination);
  return destination;
}

async function readJson(path: string): Promise<z.infer<ReturnType<typeof z.json>>> {
  return z.json().parse(JSON.parse(await readFile(path, "utf8")));
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("generateAntigravityAdapter", () => {
  it("writes a native manifest without the Agent Plugins $schema", async () => {
    const destination = await generate();
    expect(Manifest.safeParse(await readJson(join(destination, "plugin.json"))).success).toBe(true);
  });

  it("declares the three hooks at the plugin root with relative bundle paths", async () => {
    const destination = await generate();
    const hooks = HooksFile.parse(await readJson(join(destination, "hooks.json")))["fluentdev-br"];
    expect(hooks.SessionStart[0].command).toBe("node dist/tutor.mjs hook antigravity session-start");
    expect(hooks.PreInvocation[0].command).toBe("node dist/tutor.mjs hook antigravity user-prompt-submit");
    expect(hooks.Stop[0].command).toBe("node dist/tutor.mjs hook antigravity stop");
  });

  it("launches its MCP server from mcp_config.json relative to the plugin root", async () => {
    const destination = await generate();
    expect(McpConfig.safeParse(await readJson(join(destination, "mcp_config.json"))).success).toBe(true);
  });

  it("ships the skill and the bundle", async () => {
    const destination = await generate();
    expect(await readFile(join(destination, "skills", "fluentdev-br", "SKILL.md"), "utf8")).toContain("name: fluentdev-br");
    expect((await readFile(join(destination, "dist", "tutor.mjs"), "utf8")).length).toBeGreaterThan(0);
  });
});
