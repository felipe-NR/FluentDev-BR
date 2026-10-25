# Phase 1 spikes

Throwaway tooling that answers the verification questions in the [implementation plan](../docs/implementation-plan.md) (Fase 1). Results live in [docs/compatibility.md](../docs/compatibility.md). Nothing here ships in `plugin/`.

| File | Purpose |
|-|-|
| `probe.ts` | Hook recorder and minimal MCP server. Logs payloads, environment variables and store writes to `$TMPDIR/fluentdev-br-spike/events.jsonl`, and injects marker instructions to show which context reaches the model. |
| `build-probe-marketplace.ts` | Builds canonical, legacy and mixed Codex probe packages, plus a Claude Code marketplace entry (`strict: false`, inline hooks and MCP). |
| `concurrent-append.ts` | Checks that concurrent JSONL appends from several processes keep every line intact. |
| `spike-paths.ts` | Log and store locations shared by the probe. |
| `results/codex-0.154.0.json` | Sanitized result summary for the Codex 0.154.0 recheck. |

Run clients against the probe only in isolated profiles (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`), so the real `~/.claude` and `~/.codex` stay untouched. For Codex, install and inspect all three packages. Record `hooks/list`, normal hook execution, execution with an explicit trust bypass, the complete first model request and the selected model/tool configuration. Re-run the spikes when a client release changes hooks, plugins or MCP handling, and update the compatibility matrix, result summary and fixtures.
