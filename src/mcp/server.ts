import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildBriefing } from "../core/briefing.ts";
import { CorrectionCategory, CorrectionInput } from "../core/model.ts";
import { PreferencesUpdate, updatePreferences } from "../core/preferences.ts";
import { readReference } from "../core/references.ts";
import { renderReport, ReportPeriod } from "../core/report.ts";
import { appendCorrection, purgeCorrections, readCorrections } from "../core/store.ts";
import { VERSION } from "../version.ts";

export interface ServerOptions {
  readonly storeDir: string;
}

const INSTRUCTIONS = [
  "English tutor for Brazilian Portuguese speakers.",
  "Use record_corrections to log the English mistakes you correct in the user's messages, one call per message with errors.",
  "Use get_briefing for the main weaknesses, get_report for the Markdown log, set_preferences to adjust behavior, and purge_history to erase records.",
  "Read fluentdev-br://protocol for the correction protocol and fluentdev-br://profile/pt-BR for the category IDs.",
].join(" ");

const correctionElement = z.object({
  original: z.string(),
  correction: z.string(),
  category: CorrectionCategory,
  reason: z.string(),
  occurrence_id: z.string().optional(),
});

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: "fluentdev-br", version: VERSION }, { instructions: INSTRUCTIONS });
  const { storeDir } = options;

  server.registerTool(
    "record_corrections",
    {
      title: "Record corrections",
      description:
        "Store the English corrections applied to one user message. Each item needs original, correction, a category ID from the pt-BR profile and a short reason. Fragments longer than 160 characters are refused.",
      inputSchema: {
        corrections: z.array(correctionElement).min(1),
        client: z.string().optional(),
      },
    },
    async (args) => {
      const client = args.client ?? "mcp";
      let recorded = 0;
      let merged = 0;
      const skipped: string[] = [];
      for (const item of args.corrections) {
        const parsed = CorrectionInput.safeParse(item);
        if (!parsed.success) {
          skipped.push(`${item.category}: ${firstIssue(parsed.error)}`);
          continue;
        }
        const result = await appendCorrection(storeDir, parsed.data, { client, source: "tool" });
        if (result.recorded) {
          recorded += 1;
        } else {
          merged += 1;
        }
      }
      const summary = `Recorded ${String(recorded)}, merged ${String(merged)}, skipped ${String(skipped.length)}.`;
      return text(skipped.length === 0 ? summary : `${summary}\nSkipped: ${skipped.join("; ")}`);
    },
  );

  server.registerTool(
    "get_briefing",
    {
      title: "Get briefing",
      description: "Return the main English weaknesses, the last-7-days trend and a suggested focus.",
      inputSchema: { limit: z.number().int().min(1).max(20).optional() },
    },
    async (args) => text(buildBriefing(await readCorrections(storeDir), args.limit).text),
  );

  server.registerTool(
    "get_report",
    {
      title: "Get report",
      description: "Return a Markdown practice log for the given period.",
      inputSchema: { period: ReportPeriod.optional() },
    },
    async (args) => text(renderReport(await readCorrections(storeDir), args.period ?? "all")),
  );

  server.registerTool(
    "set_preferences",
    {
      title: "Set preferences",
      description:
        "Update tutor preferences: strictness, explanation language, how Portuguese messages are handled, placement, briefing, a pause (paused_until as an ISO timestamp, empty to clear) and disabled projects.",
      inputSchema: {
        strictness: z.enum(["essential", "standard", "strict"]).optional(),
        explanation_language: z.enum(["en", "pt-BR", "en-with-pt-notes"]).optional(),
        portuguese_messages: z.enum(["ignore", "hint"]).optional(),
        placement: z.enum(["top", "bottom"]).optional(),
        briefing: z.enum(["on", "off"]).optional(),
        paused_until: z.string().optional(),
        disabled_projects: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const parsed = PreferencesUpdate.safeParse(args);
      if (!parsed.success) {
        return errorText(`Invalid preferences: ${firstIssue(parsed.error)}`);
      }
      const next = await updatePreferences(storeDir, parsed.data);
      return text(`Preferences updated:\n${JSON.stringify(next, null, 2)}`);
    },
  );

  server.registerTool(
    "purge_history",
    {
      title: "Purge history",
      description:
        "Erase recorded corrections. Pass confirm: true. Give from/to (YYYY-MM-DD) to limit the range, or all: true to erase everything.",
      inputSchema: {
        confirm: z.boolean(),
        all: z.boolean().optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      },
    },
    async (args) => {
      if (!args.confirm) {
        return errorText("purge_history needs confirm: true.");
      }
      const hasRange = args.from !== undefined || args.to !== undefined;
      if (!hasRange && args.all !== true) {
        return errorText("Pass all: true to erase everything, or a from/to range.");
      }
      const removed = await purgeCorrections(storeDir, {
        ...(args.from !== undefined ? { from: args.from } : {}),
        ...(args.to !== undefined ? { to: args.to } : {}),
      });
      return text(`Removed ${String(removed)} records.`);
    },
  );

  registerPrompts(server, storeDir);
  registerResources(server, storeDir);
  return server;
}

function registerPrompts(server: McpServer, storeDir: string): void {
  server.registerPrompt(
    "fluentdev-br-on",
    { title: "FluentDev-BR on", description: "Turn on the English tutor for this session." },
    async () => {
      const protocol = await readReference("correction-protocol");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Act as my English tutor for this session. Follow this protocol on every message I write.\n\n${protocol}`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "english-review",
    { title: "English review", description: "Review my recurring English mistakes." },
    async () => promptText(buildBriefing(await readCorrections(storeDir)).text),
  );

  server.registerPrompt(
    "english-report",
    { title: "English report", description: "Show my English practice log." },
    async () => promptText(renderReport(await readCorrections(storeDir), "all")),
  );
}

function registerResources(server: McpServer, storeDir: string): void {
  server.registerResource(
    "protocol",
    "fluentdev-br://protocol",
    { title: "Correction protocol", description: "What to correct and how.", mimeType: "text/markdown" },
    async (uri) => resource(uri.href, await readReference("correction-protocol")),
  );

  server.registerResource(
    "profile-pt-br",
    "fluentdev-br://profile/pt-BR",
    { title: "pt-BR mistake profile", description: "Category IDs and examples.", mimeType: "text/markdown" },
    async (uri) => resource(uri.href, await readReference("l1-pt-br")),
  );

  server.registerResource(
    "report",
    "fluentdev-br://report",
    { title: "Practice log", description: "The full practice log.", mimeType: "text/markdown" },
    async (uri) => resource(uri.href, renderReport(await readCorrections(storeDir), "all")),
  );
}

function text(body: string): CallToolResult {
  return { content: [{ type: "text", text: body }] };
}

function errorText(body: string): CallToolResult {
  return { content: [{ type: "text", text: body }], isError: true };
}

function promptText(body: string): { messages: [{ role: "user"; content: { type: "text"; text: string } }] } {
  return { messages: [{ role: "user", content: { type: "text", text: body } }] };
}

function resource(uri: string, body: string): { contents: [{ uri: string; mimeType: string; text: string }] } {
  return { contents: [{ uri, mimeType: "text/markdown", text: body }] };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue === undefined ? "invalid input" : `${issue.path.join(".")} ${issue.message}`;
}
