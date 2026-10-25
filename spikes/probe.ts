// Phase 1 spike probe. Bundled into a throwaway plugin, it records what each
// client sends to hooks and to an MCP server, injects marker tokens to show
// whether hook or MCP context reaches the model, and tests store writes.
//
//   probe hook <client> <event>   read a hook payload on stdin
//   probe mcp <label>             serve a minimal MCP server over stdio

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { text } from "node:stream/consumers";
import { z } from "zod";
import { LOG_DIR, LOG_FILE, USER_STORE } from "./spike-paths.ts";

const ENV_KEYS: readonly string[] = [
  "PLUGIN_ROOT",
  "PLUGIN_DATA",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_CONFIG_DIR",
  "CODEX_HOME",
];

const CONTEXT_MARKERS = new Map([
  ["session-start", "fluentdev-br spike check from a SessionStart hook: end every reply with the word MANGO."],
  ["user-prompt-submit", "fluentdev-br spike check from a UserPromptSubmit hook: end this reply with the word KIWI."],
]);

const MCP_INSTRUCTIONS =
  "fluentdev-br spike check from MCP server instructions: end every reply with the word PAPAYA.";

const jsonValue = z.json();
type JsonValue = z.infer<typeof jsonValue>;

const rpcMessage = z.looseObject({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.json()).optional(),
});

type WriteOutcome = { readonly dir: string; readonly ok: true } | { readonly dir: string; readonly ok: false; readonly error: string };

function record(entry: Readonly<Record<string, JsonValue>>): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, ...entry })}\n`);
  } catch {
    // A spike probe must never break the client session.
  }
}

function environment(): Record<string, JsonValue> {
  const values: Record<string, JsonValue> = {};
  for (const key of ENV_KEYS) {
    values[key] = process.env[key] ?? null;
  }
  return values;
}

function tryWrite(dir: string): WriteOutcome {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `write-test-${String(process.pid)}.txt`), "ok\n");
    return { dir, ok: true };
  } catch (error) {
    return { dir, ok: false, error: error instanceof Error ? error.message : "write failed" };
  }
}

function storeWrites(): JsonValue {
  const targets = [USER_STORE, process.env["PLUGIN_DATA"], process.env["CLAUDE_PLUGIN_DATA"]];
  return targets
    .filter((dir) => dir !== undefined)
    .map((dir) => {
      const outcome = tryWrite(dir);
      return outcome.ok ? { dir: outcome.dir, ok: true } : { dir: outcome.dir, ok: false, error: outcome.error };
    });
}

function parsePayload(input: string): JsonValue {
  try {
    const parsed = jsonValue.safeParse(JSON.parse(input));
    return parsed.success ? parsed.data : { unparsed: input };
  } catch {
    return { unparsed: input };
  }
}

async function runHook(client: string, event: string): Promise<void> {
  const payload = parsePayload(await text(process.stdin));
  record({
    kind: "hook",
    client,
    event,
    cwd: process.cwd(),
    node: process.version,
    env: environment(),
    storeWrites: storeWrites(),
    payload,
  });
  const marker = CONTEXT_MARKERS.get(event);
  if (marker !== undefined) {
    process.stdout.write(`${marker}\n`);
  }
}

function send(message: Readonly<Record<string, JsonValue>>): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

async function runMcp(label: string): Promise<void> {
  record({ kind: "mcp-start", label, cwd: process.cwd(), node: process.version, env: environment(), storeWrites: storeWrites() });

  for await (const line of createInterface({ input: process.stdin })) {
    const parsed = rpcMessage.safeParse(parsePayload(line));
    if (!parsed.success || parsed.data.method === undefined) {
      continue;
    }
    const { id, method, params } = parsed.data;
    record({ kind: "mcp-message", label, method, params: params ?? null });
    if (id === undefined) {
      continue;
    }

    if (method === "initialize") {
      const requested = params?.["protocolVersion"];
      send({
        id,
        result: {
          protocolVersion: typeof requested === "string" ? requested : "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "fluentdev-br-probe", version: "0.0.1" },
          instructions: MCP_INSTRUCTIONS,
        },
      });
    } else if (method === "tools/list") {
      send({
        id,
        result: {
          tools: [
            {
              name: "probe_ping",
              description: "fluentdev-br spike tool. Returns pong.",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      });
    } else if (method === "tools/call") {
      send({ id, result: { content: [{ type: "text", text: "pong" }] } });
    } else if (method === "ping") {
      send({ id, result: {} });
    } else {
      send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  }
}

const [mode, first = "unknown", second = "unknown"] = process.argv.slice(2);
if (mode === "hook") {
  await runHook(first, second);
} else if (mode === "mcp") {
  await runMcp(first);
} else {
  process.stderr.write("usage: probe hook <client> <event> | probe mcp <label>\n");
  process.exitCode = 2;
}
