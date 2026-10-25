# Hook and MCP payload fixtures

Real payloads recorded by the Phase 1 spike probe (`spikes/probe.ts`) on 2026-09-13, on Linux with Node.js 24.14.1.

| Directory | Client | How the payloads were produced |
|-|-|-|
| `claude-code/` | Claude Code 2.1.270 | plugin installed from `.claude-plugin/marketplace.json` with `strict: false`, `claude -p` |
| `codex/` | Codex CLI 0.153.4 | legacy `.codex-plugin/plugin.json` package with `hooks/hooks.json`, `codex exec --dangerously-bypass-hook-trust` |
| `antigravity/` | Antigravity CLI 1.4.7 | native plugin under `.agents/plugins/fluentdev-br-probe` with `hooks.json` and `mcp_config.json`, `agy -p` |

Sanitization: user paths moved under `/home/user`, session and turn ids replaced with placeholder UUIDs, `prompt` set to `Reply with OK.` and `last_assistant_message` set to `OK`. Field names, field order and value types are unchanged.

Phase 3 contract tests feed these files to the hook adapters. Record new fixtures when a client release changes a payload, and keep the client version in this table.
