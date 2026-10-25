import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "./paths.ts";

// Codex ignores hooks in Agent Plugins packages (decision D12), so the Codex
// distribution installs this legacy package generated from plugin/. It is never
// edited by hand; the build regenerates it and CI checks it stays in sync.
export const PLUGIN_DIR = "plugin";
export const CODEX_ADAPTER_DIR = join("adapters", "codex");

type JsonValue = z.infer<ReturnType<typeof z.json>>;

const manifest = z.object({ name: z.string(), version: z.string(), description: z.string() });

// A Codex hook: the command is a shell string with a Codex-expanded
// ${PLUGIN_ROOT}, matching the Phase 1 spike that loaded legacy-package hooks.
function codexHook(event: string): JsonValue {
  return [{ hooks: [{ type: "command", command: `node "\${PLUGIN_ROOT}/dist/tutor.mjs" hook codex ${event}`, timeout: 30 }] }];
}

function stableJson(value: JsonValue): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Write the legacy Codex package into `dest`, replacing whatever is there.
export async function generateCodexAdapter(dest: string): Promise<void> {
  const source = join(repoRoot, PLUGIN_DIR);
  const parsed = manifest.parse(JSON.parse(await readFile(join(source, "plugin.json"), "utf8")));

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  await writeFileIn(dest, join(".codex-plugin", "plugin.json"), stableJson({
    name: parsed.name,
    version: parsed.version,
    description: parsed.description,
  }));

  await writeFileIn(dest, ".mcp.json", stableJson({
    mcpServers: {
      "fluentdev-br": { type: "stdio", command: "node", args: ["dist/tutor.mjs", "mcp"], cwd: "." },
    },
  }));

  await writeFileIn(dest, join("hooks", "hooks.json"), stableJson({
    hooks: {
      SessionStart: codexHook("session-start"),
      UserPromptSubmit: codexHook("user-prompt-submit"),
      Stop: codexHook("stop"),
    },
  }));

  await cp(join(source, "dist"), join(dest, "dist"), { recursive: true });
  await cp(join(source, "skills"), join(dest, "skills"), { recursive: true });
  await cp(join(source, "LICENSE"), join(dest, "LICENSE"));
}

async function writeFileIn(dest: string, relative: string, content: string): Promise<void> {
  const path = join(dest, relative);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}
