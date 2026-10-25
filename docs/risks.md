# risks.md: risk register

This file is the single source of the project's risks, their impact and the state of each mitigation, checked against the code on 2026-09-17. The original register is section 7 of `docs/implementation-plan.md`. The current architecture the mitigations refer to is in `docs/architecture.md`, and the gaps still open are listed in `docs/tasks.md`.

| Risk | Impact | Mitigation | State |
|-|-|-|-|
| Claude Code does not implement Agent Plugins (last verified on 2.1.270) | the main client depends on a client-specific marketplace | keep the canonical package intact, follow the Claude Code CHANGELOG, and remove the specific path when support arrives (`docs/backlog.md`) | in place |
| Hook contracts change between client versions | hooks stop working without warning | contract tests with recorded fixtures, empty output for a payload that does not parse, `tutor doctor` | in place; `tutor doctor` does not report received payloads, which the plan expected |
| Codex keeps ignoring hooks from Agent Plugins packages, against its own documentation | Codex depends on a generated legacy package | `adapters/codex/` generated and checked in CI; recheck S2 on each Codex release with canonical, legacy and mixed packages; remove the adapter when the hooks load | in place; last recheck on Codex 0.154.0 |
| Antigravity CLI loads hooks only from hooks.json at the root and requires enable-agent-plugins-spec for Agent Plugins mcp.json | Antigravity CLI depends on a generated native package | `adapters/antigravity/` generated and checked in CI (ADR-0003); recheck S8 on future agy releases; remove the adapter when agy supports hooks in Agent Plugins packages | in place; verified on agy 1.4.7 |
| A future client drops injected context, as the Copilot CLI documentation describes | no per-message trigger in that client | Standard mode, documented in ADR-0001 and in the skill | in place |
| A correction leaks into code, commits or files | damage to the user's work | explicit rule in the session protocol and in the protocol reference; negative cases in the evaluation | partial: the rule is in place, the evaluation is not built |
| Too many corrections | the user turns the tutor off | 3-line ceiling, silence without mistakes, configurable strictness, pause | partial: `strictness` is stored but no component reads it |
| Context cost | long sessions get expensive | protocol once per session, reminder up to 40 token-equivalents, capped briefing | partial: the session-start ceiling is enforced; the reminder measures 50 to 53 token-equivalents |
| Proprietary code in the history | data exposure | short fragments only, privacy guard, local store, purge | in place |
| Node.js not on the PATH for clients opened from a graphical interface | the MCP server and the hooks do not start | `tutor doctor` and the README install notes; a per-platform executable is in `docs/backlog.md` | in place |
| The Codex trust review, or a corporate policy, blocks hooks | Complete mode is unavailable | fall back to Standard mode | in place |
| Duplicate hooks, such as manual Luna-style hooks next to the plugin | corrections appear twice | merge by occurrence ID and mistake key, keeping repetitions from other turns; one reminder per turn | in place |
| The client exits before an asynchronous capture finishes | the last correction can miss the history | document the capture as best effort; test a process interruption | partial: documented in `docs/architecture.md`, no interruption test |
| Coexistence with the ai-memory hooks | injection order and noisy observations | coexistence test; short hook outputs | open: no coexistence test exists, and S6 recorded unattributed hook failures while ai-memory and computer-use hooks ran at the same events |
| The spec evolves (1.1.0 was in draft on 2026-09-13) | rework | `$schema` pinned to 1.0.0; review ADR-0001 on each spec release | in place |
