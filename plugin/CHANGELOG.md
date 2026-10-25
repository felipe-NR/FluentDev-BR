# Changelog

All notable changes to this plugin are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Support for Antigravity CLI (`agy`): native adapter package generated in `adapters/antigravity/` with `hooks.json`, `mcp_config.json`, and `plugin.json` without `$schema` (ADR-0003).
- Trigger adapter for Antigravity CLI (`src/hooks/antigravity.ts` and `src/hooks/antigravity-transcript.ts`): `SessionStart` system message injection, `PreInvocation` ephemeral reminder per invocation, and `Stop` correction capture via conversation transcript parsing.
- Protobuf JSON hook output formatting for Antigravity CLI (`src/hooks/output.ts`): `injectSteps` for `SessionStart` and `PreInvocation`, and `{}` for silent hooks.
- Contract fixtures and contract tests for Antigravity CLI (`test/contract/fixtures/antigravity/` and `test/contract/hooks.test.ts`).
- Freshness check `npm run check:antigravity-adapter` wired into `npm run check`.

## [0.2.0] - 2026-09-14

### Added

- Storage privacy guard (`src/core/privacy.ts`): before any correction is written, it rejects fragments that carry secrets, code, logs, file paths, URLs or whole-prompt-shaped text, at the boundary where hook and MCP input is still untrusted.
- zod validation of every stored value: the fragments, the reason, the occurrence id and the client metadata, with the recorded `mistake_key` required to match its fragments.
- A 350 token-equivalent budget for the session-start context, measured in UTF-8 bytes, fitting the briefing without splitting multi-byte characters.

### Fixed

- Codex hook and MCP wiring: the legacy launcher roots a relative `cwd` at the installed plugin directory instead of relying on unsupported placeholder expansion, so the MCP server initializes, and the hooks emit the event-specific JSON envelope Codex expects instead of plain text beginning with `[`.

## [0.1.0] - 2026-09-13

### Added

- Minimal Agent Plugins 1.0.0 manifest.
- `tutor` CLI skeleton with `help` and `version`.
- `fluentdev-br` Agent Skill with the correction protocol, the pt-BR mistake profile and the practice-log format.
- MCP server (`mcp.json`, `tutor mcp`) exposing the `record_corrections`, `get_briefing`, `get_report`, `set_preferences` and `purge_history` tools, the `fluentdev-br-on`, `english-review` and `english-report` prompts, and the `fluentdev-br://protocol`, `fluentdev-br://profile/pt-BR` and `fluentdev-br://report` resources.
- Portable core: append-only correction store with file locking and dedup, statistics, session briefing, Markdown report and preferences.
- `tutor report`, `tutor config`, `tutor purge` and `tutor doctor` commands.
- Trigger adapters for Claude Code and Codex (`tutor hook <client> <event>`): session-start protocol injection, once-per-turn reminder, and end-of-turn capture of the corrections from the assistant's final message.
- Kill switch (`FLUENTDEV_BR_DISABLE=1`), pause (`paused_until`) and per-project disable that silence every hook. A hook never breaks a session: internal errors exit 0 with empty output and are logged locally.
- Claude Code hooks declared inline in the marketplace; the Codex legacy package with hooks generated into `adapters/codex/`.
