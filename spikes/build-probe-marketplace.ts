// Builds a throwaway marketplace for the Phase 1 spikes:
//
//   <out>/.claude-plugin/marketplace.json   Claude Code, strict: false, inline hooks and MCP
//   <out>/.agents/plugins/marketplace.json  Codex repo marketplace
//   <out>/plugin/                           Canonical Agent Plugins 1.0.0 probe package
//   <out>/legacy/                           Codex legacy probe package
//   <out>/mixed/                            Root manifest plus legacy overlay probe package
//
// Usage: node spikes/build-probe-marketplace.ts <out-dir>

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import { validatePluginPackage } from "../scripts/conformance/plugin-package.ts";
import { repoRoot } from "../scripts/paths.ts";

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

const PLUGIN = "fluentdev-br-probe";
const MARKETPLACE = "fluentdev-br-spike";

const outArgument = process.argv[2];
if (outArgument === undefined) {
  throw new Error("usage: node spikes/build-probe-marketplace.ts <out-dir>");
}
const out = resolve(outArgument);
const pluginDir = join(out, "plugin");
const legacyDir = join(out, "legacy");
const mixedDir = join(out, "mixed");

async function writeJson(path: string, value: Json): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function claudeHook(event: string): Json {
  return [{ hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/probe.mjs", "hook", "claude-code", event] }] }];
}

function codexHook(event: string): Json {
  return [{ hooks: [{ type: "command", command: `node "\${PLUGIN_ROOT}/dist/probe.mjs" hook codex ${event}`, timeout: 30 }] }];
}

const codexHooks: Json = {
  hooks: {
    SessionStart: codexHook("session-start"),
    UserPromptSubmit: codexHook("user-prompt-submit"),
    Stop: codexHook("stop"),
  },
};

async function writeSkill(directory: string, name: string): Promise<void> {
  await mkdir(join(directory, "skills", name), { recursive: true });
  await writeFile(
    join(directory, "skills", name, "SKILL.md"),
    `---\nname: ${name}\ndescription: Spike skill for FluentDev-BR. Use only when the user asks about the fluentdev-br probe.\n---\n\nReply that the fluentdev-br probe skill loaded.\n`,
  );
}

await build({
  absWorkingDir: repoRoot,
  entryPoints: ["spikes/probe.ts"],
  outfile: join(pluginDir, "dist", "probe.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  logLevel: "warning",
});

await writeJson(join(pluginDir, "plugin.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: PLUGIN,
  version: "0.0.1",
  description: "Phase 1 spike probe for FluentDev-BR. Records hook payloads and MCP handshakes.",
  extensions: { "com.openai": { hooks: "./com.openai/hooks/hooks.json" } },
});

await writeJson(join(pluginDir, "mcp.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: {
    [PLUGIN]: { type: "stdio", command: "node", args: ["${PLUGIN_ROOT}/dist/probe.mjs", "mcp", "agent-plugins-mcp-json"] },
  },
});

await writeJson(join(pluginDir, "com.openai", "hooks", "hooks.json"), codexHooks);

await writeSkill(pluginDir, PLUGIN);

await mkdir(join(legacyDir, "dist"), { recursive: true });
await copyFile(join(pluginDir, "dist", "probe.mjs"), join(legacyDir, "dist", "probe.mjs"));
await writeJson(join(legacyDir, ".codex-plugin", "plugin.json"), {
  name: `${PLUGIN}-legacy`,
  version: "0.0.1",
});
await writeJson(join(legacyDir, "hooks", "hooks.json"), codexHooks);
await writeSkill(legacyDir, `${PLUGIN}-legacy`);

await mkdir(join(mixedDir, "dist"), { recursive: true });
await copyFile(join(pluginDir, "dist", "probe.mjs"), join(mixedDir, "dist", "probe.mjs"));
await writeJson(join(mixedDir, "plugin.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: `${PLUGIN}-mixed`,
  version: "0.0.1",
  description: "Phase 1 mixed-format probe for FluentDev-BR.",
  extensions: { "com.openai": { hooks: "./com.openai/hooks/hooks.json" } },
});
await writeJson(join(mixedDir, "com.openai", "hooks", "hooks.json"), codexHooks);
await writeJson(join(mixedDir, ".codex-plugin", "plugin.json"), {
  name: `${PLUGIN}-mixed`,
  version: "0.0.1",
  hooks: "./hooks/hooks.json",
});
await writeJson(join(mixedDir, "hooks", "hooks.json"), codexHooks);
await writeSkill(mixedDir, `${PLUGIN}-mixed`);

await writeJson(join(out, ".claude-plugin", "marketplace.json"), {
  name: MARKETPLACE,
  owner: { name: "FluentDev-BR spikes" },
  plugins: [
    {
      name: PLUGIN,
      source: "./plugin",
      strict: false,
      skills: "./skills/",
      mcpServers: {
        [PLUGIN]: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/probe.mjs", "mcp", "claude-marketplace-inline"] },
      },
      hooks: {
        SessionStart: claudeHook("session-start"),
        UserPromptSubmit: claudeHook("user-prompt-submit"),
        Stop: claudeHook("stop"),
      },
    },
  ],
});

await writeJson(join(out, ".agents", "plugins", "marketplace.json"), {
  name: MARKETPLACE,
  interface: { displayName: "FluentDev-BR spikes" },
  plugins: [
    {
      name: `${PLUGIN}-legacy`,
      source: { source: "local", path: "./legacy" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    },
    {
      name: `${PLUGIN}-mixed`,
      source: { source: "local", path: "./mixed" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    },
    {
      name: PLUGIN,
      source: { source: "local", path: "./plugin" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    },
  ],
});

const findings = await validatePluginPackage(pluginDir);
console.log(`probe marketplace written to ${out}`);
console.log(findings.length === 0 ? "probe package conforms to Agent Plugins 1.0.0" : JSON.stringify(findings, null, 2));
