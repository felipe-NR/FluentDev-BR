# Client compatibility

Verified through 2026-09-14 with the Phase 1 spikes and an installed-package wiring audit, on Linux 7.0 and Node.js 24.14.1. Codex was first tested on 0.153.4 and rechecked on 0.154.0. Every client ran in an isolated profile (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`). The 0.154.0 recheck used a local Responses-compatible HTTP server with fixed responses, so it called no real model and used no credentials. The probe package, marketplace builder, recorded Codex result and concurrency experiment live in [`spikes/`](../spikes/), and the recorded payloads live in [`test/contract/fixtures/`](../test/contract/fixtures/).

## Summary

| Question | Claude Code 2.1.270 | Codex CLI 0.153.4 and 0.154.0 |
|-|-|-|
| Installs the canonical Agent Plugins package | yes, from `.claude-plugin/marketplace.json` with `strict: false` | yes, from `.agents/plugins/marketplace.json` |
| Root Agent Plugins `plugin.json` conflicts with the client format | no | no |
| Skills from `skills/` | yes | yes, shown to the model as `plugin:skill` |
| MCP server source | marketplace entry; `mcp.json` is ignored | legacy `.mcp.json`; relative `cwd` resolves from the installed plugin root, but `${PLUGIN_ROOT}` in `args` stays literal |
| MCP `instructions` reach the model | yes | `gpt-5.4`: yes, in `tool_search` metadata; `gpt-6-astra`: absent from the first recorded request |
| Hooks from the canonical package | yes, declared inline in the marketplace entry | **no**: hooks are never loaded for Agent Plugins packages |
| Hooks from a legacy `.codex-plugin/plugin.json` package | not applicable | yes, from `hooks/hooks.json` |
| `SessionStart` and `UserPromptSubmit` stdout reaches the model | yes | yes; use event-specific `hookSpecificOutput.additionalContext` JSON because 0.154.0 parses a leading `[` as JSON |
| `Stop` payload carries `last_assistant_message` | yes | yes |
| Hook trust | no extra step after install | required; `codex exec` skips untrusted hooks without a warning |
| Hooks and MCP servers write the per-user store | yes, also with the sandbox enabled | yes, also with `-s read-only` |
| Mode with the canonical package | **Completo** | **Padrão** |
| Mode with the generated legacy package (decision D12) | not applicable | **Completo** |
| Correction-protocol adherence, real-model live run (S5) | strong: 3 of 3 caught, correct format, recorded | inconclusive: the installed hook and MCP wiring failed during the run |

## S1: Claude Code

- `claude plugin marketplace add <dir>` and `claude plugin install fluentdev-br-probe@fluentdev-br-spike --scope user -y` installed the probe from `./plugin`. `claude plugin details` listed 1 skill, 3 hooks (`SessionStart`, `UserPromptSubmit`, `Stop`) and 1 MCP server.
- The root `plugin.json` in Agent Plugins format caused no conflict with `strict: false`.
- The MCP server started from the marketplace entry. Claude Code does not read the Agent Plugins `mcp.json`.
- A `claude -p` run echoed the markers from `SessionStart`, `UserPromptSubmit` and the MCP `instructions`, so all three reach the model.
- `SessionStart` and `UserPromptSubmit` hooks fire before authentication. They ran in a profile that was not logged in, so the adapter must stay cheap and side-effect free.
- For a marketplace added from a local directory, `CLAUDE_PLUGIN_ROOT` points at the source directory, not at the copy under `plugins/cache/`.

## S2: Codex

- `codex plugin marketplace add <dir>` read `.agents/plugins/marketplace.json` and ignored `.claude-plugin/marketplace.json` in the same directory. `codex plugin add fluentdev-br-probe@fluentdev-br-spike` copied the package to `plugins/cache/<marketplace>/<plugin>/<version>/`.
- Hooks declared for the Agent Plugins package never ran, with or without `--dangerously-bypass-hook-trust`. Five declarations failed the same way: `extensions.com.openai.hooks` as a path to `./com.openai/hooks/hooks.json`, as a path to `./hooks/hooks.json`, as an array of paths, as an inline object, and the default `hooks/hooks.json` with no extension field.
- The Codex source explains it. [`loader.rs`](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/core-plugins/src/loader.rs#L954-L964) returns no hook sources when the manifest format is `AgentPlugin`. The relevant loader and Agent Plugins manifest blobs are identical in 0.153.4 and 0.154.0. The [OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins) describes `extensions.com.openai.hooks` for Agent Plugins packages, so the documentation and the implementation disagree.
- A package with only `.codex-plugin/plugin.json` and `hooks/hooks.json` loaded its hooks. They received `PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`.
- User hooks in `$CODEX_HOME/hooks.json` and legacy plugin hooks both ran only with `--dangerously-bypass-hook-trust`. Without the flag, `codex exec` skipped them and printed nothing.
- The session transcript showed the stdout of `SessionStart` and `UserPromptSubmit` as developer messages. Two hook sources with the same output produced two developer messages, which confirms the need for per-turn deduplication.
- `codex exec` waits for stdin to close when stdin is not a terminal ("Reading additional input from stdin..."). Automation has to redirect stdin from `/dev/null`.
- The 0.154.0 recheck built three packages in a fresh profile. `hooks/list` returned `0` hooks for the canonical package, `1` untrusted hook for the legacy package and `0` hooks for the mixed root-manifest and legacy-overlay package. The legacy hook was absent from model context without a trust bypass and present with one. The canonical hook was absent with a bypass too. The sanitized summary is [`spikes/results/codex-0.154.0.json`](../spikes/results/codex-0.154.0.json).

## S3: MCP `instructions`

| Client and model | `clientInfo` | Protocol version | `instructions` in the recorded first model request |
|-|-|-|-|
| Claude Code | `{"name":"claude-code","title":"Claude Code","version":"2.1.270"}` | `2025-11-25` | yes |
| Codex `gpt-5.4` | `{"name":"codex-mcp-client","title":"Codex","version":"0.154.0"}` | `2025-06-18` | absent from `prompt.input`, present in the `tool_search` description as `audit-mcp: AUDIT_MCP_INSTRUCTIONS_PAPAYA` |
| Codex `gpt-6-astra` | `{"name":"codex-mcp-client","title":"Codex","version":"0.154.0"}` | `2025-06-18` | absent from the full first request, including `input.additional_tools`; disabling `code_mode` did not change this |

The 0.154.0 request summaries are identical to the 0.153.4 baseline. The MCP server received `initialize` and returned the marker for every run. `codex debug prompt-input` remains insufficient evidence for tool metadata because it returns only `prompt.input`.

## S4: Store

- Hooks and MCP servers of both clients created and wrote files in a directory under the OS user's home and in the client's plugin data directory. That held with the Claude Code sandbox enabled (`{"sandbox":{"enabled":true}}`) and with Codex `-s read-only`; both sandboxes govern the model's shell commands, not hooks or MCP servers.
- Plugin data directories: Claude Code uses `<config>/plugins/data/<plugin>-<marketplace>`; Codex uses `<CODEX_HOME>/plugins/data/agent-plugins/<sha256>` for Agent Plugins packages and `<CODEX_HOME>/plugins/data/<plugin>-<marketplace>` for legacy packages.
- `spikes/concurrent-append.ts` ran 8 processes appending 2,000 lines each with `appendFileSync`. With 200-byte and 8,000-byte lines, on tmpfs (3 runs) and ext4 (1 run), every one of the 16,000 lines parsed and none was lost or repeated. Windows was not tested, so the store keeps the planned file lock.

## S5: Live real-model run of release 0.1.0

The S1-S4 spikes used fixed-response servers and called no real model. This section records the first live run of the released `0.1.0` plugin against real models, installed from the GitHub-shorthand marketplace (`felipe-NR/FluentDev-BR`, commit `f723a2f`) into an existing profile on 2026-09-13. These are single, non-deterministic observations, not a measured eval; they are Phase 5 input, not a precision or recall number.

Install followed the README verbatim: `claude plugin marketplace add` then `claude plugin install` for Claude Code, and `codex plugin marketplace add` then `codex plugin add` for Codex. Both resolved the GitHub shorthand and the repo-relative sources (`./plugin`; `./adapters/codex` for the Codex hooks). Codex installed the plugin from `adapters/codex`, the legacy package, and `codex mcp list` showed the `fluentdev-br` MCP server enabled, loaded from its `.mcp.json`.

The same English-error message went to both clients: "I have a doubt about promises. Can you explain me how async works? I am developer since 5 years and I still confuse this."

Claude Code (2.1.270, default model, `claude -p`, model not pinned):

- Caught all three errors and opened the reply with the protocol format: `✏️ [doubt-question]`, `✏️ [verb-pattern]`, `✏️ [tense-aspect]`, each with the arrow, a short reason, and a pt-BR note where the category calls for one.
- Called `record_corrections`; the three fragments persisted in pattern tracking and the daily log.
- A correct-English message and a Portuguese message each drew no correction, and the Portuguese one was answered in Portuguese, matching `portuguese_messages: ignore`.

Codex (0.154.0, `gpt-5.6-terra`, `codex exec --dangerously-bypass-hook-trust --skip-git-repo-check -s read-only`):

- Caught one of the three errors ("explain me" to "explain ... to me"). It missed the `doubt-question` false friend and the `tense-aspect` error.
- Wrote a single loose "Small English note" at the bottom of the reply instead of the `✏️ [category]` lines at the top.
- Did not call `record_corrections`; nothing was written to the store.
- The tutor skill was available, but the installed hooks and MCP server were not. The correction therefore does not isolate adherence to the hook protocol, and the missing record cannot be attributed to model behavior. The 2026-09-14 audit below supersedes the earlier wiring conclusion.

## S6: Installed Codex wiring audit

Codex 0.154.0 reproduced both startup failures from the installed release package.

- The `ai-memory` `SessionStart` and `UserPromptSubmit` hooks exited 0 with empty stdout and stderr. The tutor hooks exited 0 with non-empty text beginning `[fluentdev-br]`. Controlled hooks showed that alphabetic plain text succeeds while a leading `[` is parsed as JSON and rejected. The event-specific [SessionStart](https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/session-start.command.output.schema.json) and [UserPromptSubmit](https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/user-prompt-submit.command.output.schema.json) JSON envelopes both succeeded.
- Codex listed `fluentdev-br` before startup, but `initialize` never completed. Process tracing showed `node` receiving the literal argument `${PLUGIN_ROOT}/dist/tutor.mjs`. The legacy MCP loader roots a relative `cwd` at the installed plugin directory, so `command: "node"`, `args: ["dist/tutor.mjs", "mcp"]`, and `cwd: "."` avoid unsupported placeholder expansion. The corrected launcher completed `get_briefing` calls on Codex 0.153.4 and 0.154.0 in isolated installed-plugin profiles.
- S5 must be rerun after installing the corrected package. Its recorded Claude result remains valid; its Codex result remains useful only as evidence of the broken release wiring.

`codex exec` printed interleaved `hook: ... Failed` lines, but ai-memory and computer-use also register hooks at those events and the tutor hooks exit 0 with correct output when run standalone, so the failures are not attributable to the tutor without a targeted single-plugin trace.

For Phase 5: the protocol text that yields strong adherence on Claude Code under-performs on Codex `gpt-5.6-terra`, which is newer than the `gpt-5.4` and `gpt-6-astra` recorded in S3. The eval set and runner should measure Codex separately by model, and the protocol tuning should aim to raise Codex adherence (format and recording) toward the Claude Code baseline. `gpt-5.6-terra` is a new data point beyond the models S3 recorded.

## Environment variables

| Variable | Claude Code hooks and MCP | Codex MCP (Agent Plugins package) | Codex hooks (legacy package) |
|-|-|-|-|
| `PLUGIN_ROOT` | no | yes | yes |
| `PLUGIN_DATA` | no | yes | yes |
| `CLAUDE_PLUGIN_ROOT` | yes | no | yes |
| `CLAUDE_PLUGIN_DATA` | yes | no | yes |
| `CLAUDE_PROJECT_DIR` | yes | no | no |

## Hook payload fields

| Event | Claude Code | Codex |
|-|-|-|
| `SessionStart` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `source` | adds `model`, `permission_mode` |
| `UserPromptSubmit` | `session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `hook_event_name`, `prompt` | `session_id`, `turn_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `prompt` |
| `Stop` | adds `effort`, `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons` | adds `turn_id`, `model`, `stop_hook_active`, `last_assistant_message` |

## Reproduce

```sh
node spikes/build-probe-marketplace.ts /tmp/probe-marketplace
CLAUDE_CONFIG_DIR=/tmp/claude-profile claude plugin marketplace add /tmp/probe-marketplace
CLAUDE_CONFIG_DIR=/tmp/claude-profile claude plugin install fluentdev-br-probe@fluentdev-br-spike -y
CODEX_HOME=/tmp/codex-profile codex plugin marketplace add /tmp/probe-marketplace
CODEX_HOME=/tmp/codex-profile codex plugin add fluentdev-br-probe@fluentdev-br-spike
CODEX_HOME=/tmp/codex-profile codex plugin add fluentdev-br-probe-legacy@fluentdev-br-spike
CODEX_HOME=/tmp/codex-profile codex plugin add fluentdev-br-probe-mixed@fluentdev-br-spike
node spikes/concurrent-append.ts
```

The builder creates canonical (`plugin/`), legacy (`legacy/`) and mixed (`mixed/`) packages. Capture and retain the complete `hooks/list` response for each package, one normal execution and one explicit trust-bypass execution, plus the full first request to a local fixed-response provider for every tested model/tool configuration. The expected 0.154.0 outcomes are in [`spikes/results/codex-0.154.0.json`](../spikes/results/codex-0.154.0.json). The probe appends every event to `$TMPDIR/fluentdev-br-spike/events.jsonl` and tests writes to `~/.fluentdev-br-spike`. Both profiles need a login before authenticated Claude Code runs; the local Codex provider test does not.
