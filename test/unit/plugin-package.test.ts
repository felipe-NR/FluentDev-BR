import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { type Finding, validatePluginPackage } from "../../scripts/conformance/plugin-package.ts";

const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const minimalManifest = JSON.stringify({ $schema: PLUGIN_SCHEMA, name: "sample-plugin" });

const createdDirectories: string[] = [];

async function makePackage(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "plugin-package-"));
  createdDirectories.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

function paths(findings: readonly Finding[]): string[] {
  return findings.map((finding) => finding.path);
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("validatePluginPackage", () => {
  it("accepts the repository's canonical package", async () => {
    const root = fileURLToPath(new URL("../../plugin/", import.meta.url));
    expect(await validatePluginPackage(root)).toEqual([]);
  });

  it("accepts a minimal package with a namespaced client extension", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "skills/example/SKILL.md": "---\nname: example\ndescription: Example.\n---\n",
      "com.openai/hooks/hooks.json": "{}",
      "mcp.json": JSON.stringify({ $schema: MCP_SCHEMA, mcpServers: {} }),
    });
    expect(await validatePluginPackage(root)).toEqual([]);
  });

  it("reports a missing manifest", async () => {
    const root = await makePackage({ "LICENSE": "MIT" });
    expect(paths(await validatePluginPackage(root))).toEqual(["plugin.json"]);
  });

  it("reports unknown top-level manifest fields and invalid names", async () => {
    const root = await makePackage({
      "plugin.json": JSON.stringify({ $schema: PLUGIN_SCHEMA, name: "My-Plugin", hooks: "./hooks.json" }),
    });
    const messages = (await validatePluginPackage(root)).map((finding) => finding.message);
    expect(messages.some((message) => message.includes('"additionalProperty":"hooks"'))).toBe(true);
    expect(messages.some((message) => message.startsWith("/name"))).toBe(true);
  });

  it("reports extension keys that are not reverse-domain namespaces", async () => {
    const root = await makePackage({
      "plugin.json": JSON.stringify({ $schema: PLUGIN_SCHEMA, name: "sample-plugin", extensions: { codex: {} } }),
    });
    expect(await validatePluginPackage(root)).toEqual([
      { path: "plugin.json", message: "/extensions/codex is not a reverse-domain namespace (spec §8.1)" },
    ]);
  });

  it("reports client-specific files outside namespace directories", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "hooks/hooks.json": "{}",
      ".mcp.json": "{}",
      ".claude-plugin/plugin.json": "{}",
    });
    expect(paths(await validatePluginPackage(root))).toEqual([".claude-plugin", ".mcp.json", "hooks"]);
  });

  it("reports an MCP configuration that breaks the schema", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "mcp.json": JSON.stringify({ $schema: MCP_SCHEMA, mcpServers: { tutor: { command: "node" } } }),
    });
    expect(paths(await validatePluginPackage(root))).toContain("mcp.json");
  });

  it("reports an MCP command that is not a single token", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "mcp.json": JSON.stringify({
        $schema: MCP_SCHEMA,
        mcpServers: { tutor: { type: "stdio", command: "node dist/tutor.mjs" } },
      }),
    });
    const messages = (await validatePluginPackage(root)).map((finding) => finding.message);
    expect(messages.some((message) => message.includes("single executable token"))).toBe(true);
  });

  it("reports a skill whose frontmatter name does not match its directory", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "skills/tutor/SKILL.md": "---\nname: fluentdev-br\ndescription: Tutor.\n---\n",
    });
    expect(await validatePluginPackage(root)).toContainEqual({
      path: "skills/tutor/SKILL.md",
      message: 'frontmatter name "fluentdev-br" does not match the directory "tutor" (Agent Skills §2)',
    });
  });

  it("reports a skill missing SKILL.md and one missing its description", async () => {
    const root = await makePackage({
      "plugin.json": minimalManifest,
      "skills/empty/other.md": "nothing",
      "skills/thin/SKILL.md": "---\nname: thin\n---\n",
    });
    const messages = (await validatePluginPackage(root)).map((finding) => finding.message);
    expect(messages).toContain("is missing SKILL.md (Agent Skills §2)");
    expect(messages.some((message) => message.includes("missing `description`"))).toBe(true);
  });

  it("reports invalid JSON", async () => {
    const root = await makePackage({ "plugin.json": "{ not json" });
    const [finding] = await validatePluginPackage(root);
    expect(finding?.message).toMatch(/^is not valid JSON/);
  });

  it.skipIf(process.platform === "win32")("reports symlinks that escape the plugin root", async () => {
    const outside = await makePackage({ "secret.txt": "outside" });
    const root = await makePackage({ "plugin.json": minimalManifest, "skills/example/SKILL.md": "x" });
    await symlink(join(outside, "secret.txt"), join(root, "skills", "example", "leak.txt"));
    expect(await validatePluginPackage(root)).toContainEqual({
      path: join("skills", "example", "leak.txt"),
      message: "resolves outside the plugin root (spec §4.1)",
    });
  });
});
