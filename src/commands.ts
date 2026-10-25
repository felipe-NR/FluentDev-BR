import { text as readStream } from "node:stream/consumers";
import type { ZodError } from "zod";
import { type Preferences, readPreferences, PreferencesUpdate, updatePreferences } from "./core/preferences.ts";
import { resolveReferencesDir, resolveStoreDir } from "./core/paths.ts";
import { renderReport, ReportPeriod } from "./core/report.ts";
import { purgeCorrections, readCorrections } from "./core/store.ts";
import { emptyHookOutput, formatHookOutput } from "./hooks/output.ts";
import { runHook } from "./hooks/runner.ts";
import { ClientId, HookEvent } from "./hooks/types.ts";
import { startStdioServer } from "./mcp/stdio.ts";

export interface CommandOutcome {
  readonly handled: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const UNHANDLED: CommandOutcome = { handled: false, exitCode: 0, stdout: "", stderr: "" };

// Dispatch the commands that need async work or filesystem access. Returns
// handled: false for help/version/unknown, which the synchronous run() covers.
export async function dispatch(argv: readonly string[]): Promise<CommandOutcome> {
  const [command, ...rest] = argv;
  switch (command) {
    case "mcp":
      await startStdioServer();
      return { handled: true, exitCode: 0, stdout: "", stderr: "" };
    case "report":
      return report(rest);
    case "config":
      return config(rest);
    case "purge":
      return purge(rest);
    case "doctor":
      return doctor();
    case "hook":
      return hook(rest);
    default:
      return UNHANDLED;
  }
}

// A hook translates one client event. It must never break a session: an
// unknown client or event, an unreachable store or any internal error all end
// as exit 0 with the client's empty output (docs/architecture.md,
// "CLI and hook rules").
async function hook(args: readonly string[]): Promise<CommandOutcome> {
  const client = ClientId.safeParse(args[0]);
  const event = HookEvent.safeParse(args[1]);
  if (!client.success) {
    return { handled: true, exitCode: 0, stdout: "", stderr: "" };
  }
  const empty = emptyHookOutput(client.data);
  if (!event.success) {
    return { handled: true, exitCode: 0, stdout: empty, stderr: "" };
  }
  const dir = safeStoreDir();
  if (dir === undefined) {
    return { handled: true, exitCode: 0, stdout: empty, stderr: "" };
  }
  const payload = await readStream(process.stdin).catch(() => "");
  const context = await runHook(client.data, event.data, payload, dir);
  const stdout = formatHookOutput(client.data, event.data, context);
  return { handled: true, exitCode: 0, stdout, stderr: "" };
}

function safeStoreDir(): string | undefined {
  try {
    return resolveStoreDir().dir;
  } catch {
    return undefined;
  }
}

async function report(args: readonly string[]): Promise<CommandOutcome> {
  const raw = optionValue(args, "--period") ?? "all";
  const period = ReportPeriod.safeParse(raw);
  if (!period.success) {
    return fail(`report: --period must be day, week or all (got "${raw}")`);
  }
  const dir = resolveStoreDir().dir;
  return ok(renderReport(await readCorrections(dir), period.data));
}

async function config(args: readonly string[]): Promise<CommandOutcome> {
  const [action, key, ...values] = args;
  const dir = resolveStoreDir().dir;
  if (action === "get") {
    const prefs = await readPreferences(dir);
    if (key === undefined) {
      return ok(`${JSON.stringify(prefs, null, 2)}\n`);
    }
    const value = preferenceStrings(prefs).get(key);
    if (value === undefined) {
      return fail(`config: unknown preference "${key}"`);
    }
    return ok(`${value}\n`);
  }
  if (action === "set") {
    if (key === undefined || values.length === 0) {
      return fail("config: usage is `config set <key> <value>`");
    }
    const patch = PreferencesUpdate.safeParse({ [key]: parseValue(key, values) });
    if (!patch.success) {
      return fail(`config: ${firstIssue(patch.error)}`);
    }
    const next = await updatePreferences(dir, patch.data);
    return ok(`${JSON.stringify(next, null, 2)}\n`);
  }
  return fail("config: usage is `config get [key]` or `config set <key> <value>`");
}

async function purge(args: readonly string[]): Promise<CommandOutcome> {
  if (!args.includes("--yes")) {
    return fail("purge: add --yes to confirm. Optionally --all or --from/--to (YYYY-MM-DD).");
  }
  const from = optionValue(args, "--from");
  const to = optionValue(args, "--to");
  if (from === undefined && to === undefined && !args.includes("--all")) {
    return fail("purge: pass --all to erase everything, or --from/--to for a range.");
  }
  const dir = resolveStoreDir().dir;
  const removed = await purgeCorrections(dir, {
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  });
  return ok(`Removed ${String(removed)} records.\n`);
}

function doctor(): CommandOutcome {
  const lines = [`node ${process.version}`];
  try {
    const store = resolveStoreDir();
    lines.push(`store ${store.dir} (${store.origin})`);
  } catch (error) {
    lines.push(`store unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    lines.push(`references ${resolveReferencesDir()}`);
  } catch (error) {
    lines.push(`references unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  return ok(`${lines.join("\n")}\n`);
}

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function parseValue(key: string, values: readonly string[]): string | string[] {
  if (key === "disabled_projects") {
    return values.flatMap((value) => value.split(",")).filter((value) => value !== "");
  }
  return values[0] ?? "";
}

// A string view of each preference, keyed by name, so `config get <key>` reads
// one value without an index-signature access or a type assertion.
function preferenceStrings(prefs: Preferences): Map<string, string> {
  return new Map([
    ["strictness", prefs.strictness],
    ["explanation_language", prefs.explanation_language],
    ["portuguese_messages", prefs.portuguese_messages],
    ["placement", prefs.placement],
    ["briefing", prefs.briefing],
    ["paused_until", prefs.paused_until ?? ""],
    ["disabled_projects", JSON.stringify(prefs.disabled_projects)],
  ]);
}

function firstIssue(error: ZodError): string {
  const issue = error.issues[0];
  return issue === undefined ? "invalid value" : `${issue.path.join(".")} ${issue.message}`;
}

function ok(stdout: string): CommandOutcome {
  return { handled: true, exitCode: 0, stdout, stderr: "" };
}

function fail(message: string): CommandOutcome {
  return { handled: true, exitCode: 1, stdout: "", stderr: `${message}\n` };
}
