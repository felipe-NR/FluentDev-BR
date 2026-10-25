# history.md: post-MVP closed work

This file records items assumed and closed after the MVP. The initial plan and Phases 0 to 5 are frozen in `docs/implementation-plan.md`, active work is in `docs/tasks.md`, and unassumed future possibilities are in `docs/backlog.md`. Rules for updating these records are in `AGENTS.md`.

## 2026-10-25: Antigravity CLI support

- **Item**: Antigravity CLI (`agy`) support (spike S8 in backlog).
- **Decision**: [ADR-0003](adr/0003-antigravity-adapter.md) accepted. Antigravity CLI loads hooks only from `hooks.json` at the plugin root and requires `enable-agent-plugins-spec` for Agent Plugins `mcp.json`. The package ships as a generated native package in `adapters/antigravity/` outside `plugin/`, keeping `plugin/` 100% conformant to Agent Plugins 1.0.0.
- **Evidence**:
  - Spike S8 recorded in `docs/compatibility.md` using Antigravity CLI 1.4.7 on Linux.
  - Sanitized real hook and MCP payload fixtures recorded under `test/contract/fixtures/antigravity/`.
  - Trigger adapter implemented in `src/hooks/antigravity.ts` and `src/hooks/antigravity-transcript.ts`, formatting output in `src/hooks/output.ts`.
  - Complete mode supported: `SessionStart` injects persistent protocol context, `PreInvocation` injects ephemeral reminders once per model invocation, and `Stop` captures corrections from conversation transcripts or `finalModelOutput`.
  - Adapter generator in `scripts/antigravity-adapter.ts` and freshness check in `scripts/check-antigravity-adapter.ts` added to `npm run check`.
  - Contract tests in `test/contract/hooks.test.ts` and unit tests in `test/unit/antigravity-adapter.test.ts`, `test/unit/antigravity-transcript.test.ts`, and `test/unit/hook-output.test.ts`.
  - Validated with `agy plugin validate adapters/antigravity --strict` (0 findings) and live headless verification with `gemini-3.8-flash-low`.
