import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "./paths.ts";

// The Antigravity CLI loads hooks only from hooks.json at the plugin root and,
// with its Agent Plugins support behind a flag that is off by default, MCP
// servers only from mcp_config.json (S8, ADR-0003). The Antigravity
// distribution therefore installs this native package generated from plugin/.
// It is never edited by hand; the build regenerates it and CI checks it.
export const PLUGIN_DIR = "plugin";
export const ANTIGRAVITY_ADAPTER_DIR = join("adapters", "antigravity");

type JsonValue = z.infer<ReturnType<typeof z.json>>;

const manifest = z.object({ name: z.string(), version: z.string(), description: z.string() });

// agy runs a hook command through `sh -c` with the plugin directory as the
// working directory, so a relative path reaches the bundle.
function antigravityHook(event: string): JsonValue {
  return [{ command: `node dist/tutor.mjs hook antigravity ${event}`, timeout: 30 }];
}

function stableJson(value: JsonValue): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Write the native Antigravity package into `dest`, replacing whatever is there.
export async function generateAntigravityAdapter(dest: string): Promise<void> {
  const source = join(repoRoot, PLUGIN_DIR);
  const parsed = manifest.parse(JSON.parse(await readFile(join(source, "plugin.json"), "utf8")));

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  // No $schema: a manifest that declares the Agent Plugins schema loads as an
  // Agent Plugins package only while enable-agent-plugins-spec is on.
  await writeFile(join(dest, "plugin.json"), stableJson({
    name: parsed.name,
    version: parsed.version,
    description: parsed.description,
  }), "utf8");

  await writeFile(join(dest, "mcp_config.json"), stableJson({
    mcpServers: {
      "fluentdev-br": { command: "node", args: ["dist/tutor.mjs", "mcp"] },
    },
  }), "utf8");

  await writeFile(join(dest, "hooks.json"), stableJson({
    "fluentdev-br": {
      SessionStart: antigravityHook("session-start"),
      PreInvocation: antigravityHook("user-prompt-submit"),
      Stop: antigravityHook("stop"),
    },
  }), "utf8");

  await cp(join(source, "dist"), join(dest, "dist"), { recursive: true });
  await cp(join(source, "skills"), join(dest, "skills"), { recursive: true });
  await cp(join(source, "LICENSE"), join(dest, "LICENSE"));
}
