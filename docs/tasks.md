# tasks.md: active work

This file is the single source of assumed work, its current state and the evidence still needed to close it. The history of the initial plan and of Phases 0 to 5 is in `docs/implementation-plan.md`, and possibilities after the MVP that nobody has assumed yet are in `docs/backlog.md`. The rules for reading and updating these files are in `AGENTS.md`.

## Current state

Release `0.2.0` shipped on 2026-09-14. The MVP closed with Phases 0 to 5, and its closure record is at the end of `docs/implementation-plan.md`. The active work is the evaluation and measurement block that the plan moved from Phase 5 to the start of Phase 6, because it spends real-model tokens or needs a Windows machine.

Measurements and client observations are recorded in `docs/compatibility.md`. When an item closes, its evidence moves to `docs/history.md`, created at the first closure.

## Evaluation and measurements

### Evaluation set

Messages from Brazilian developers: mistakes labeled by category, correct sentences, messages with code and logs, and messages written in Portuguese.

Closes with: the set committed to the repository.

### Evaluation runner

A runner that uses the non-interactive mode of both clients (`claude -p` and `codex exec`) and measures precision and recall per category, false positives inside code, format adherence and silence when there is no mistake. It measures Codex separately per model, because `gpt-5.6-terra` under-performed Claude Code in the live run (`docs/compatibility.md`, S5 and S6). The S5 re-run on Codex after 0.2.0 has no recorded result (closure record in `docs/implementation-plan.md`), so this runner is also what turns Codex adherence into evidence.

Closes with: the runner in the repository and one recorded run per client and model.

### Protocol tuning

Adjust the protocol text from the measurements, aiming to bring Codex adherence (format and recording) closer to the Claude Code level.

Closes with: the runner's measurements before and after the change.

### Hook latency and Windows smoke test

Measure the synchronous hooks against the p95 target below 300 ms, and run Claude Code and Codex on Windows.

Closes with: the p95 per hook and client, and the Windows run recorded in `docs/compatibility.md`.

### Targets

Initial targets, recalibrated after the first measurement: no correction inside code, the correct format in 95% of the replies with corrections, and silence in 95% of the messages without mistakes. The per-message reminder also has a 40 token-equivalent target that nothing enforces: with three focus phrases and the occurrence tag, it measures 50 to 53 token-equivalents (`docs/architecture.md`, "Context budget").

Closes with: the first measurement and the recalibrated targets.

## Open questions for the owner

Gaps found on 2026-09-17, while `docs/architecture.md` and `docs/risks.md` were checked against the code. Each one needs a decision: assume it as work in this file, or accept the documented behavior.

- **Preferences that no component reads.** `strictness`, `explanation_language`, `portuguese_messages` and `placement` are validated and stored, but the session protocol is a fixed text and no preference value reaches the model. The `hint` mode of D6 has no effect (`docs/architecture.md`, "Preferences").
- **Protocol injection described inaccurately.** `references/correction-protocol.md` says its text is injected once per session, and the comment in `src/core/references.ts` says the session-start hook serves the references. The hook injects the compact `SESSION_PROTOCOL` from `src/core/protocol.ts` instead (`docs/architecture.md`, "Correction protocol").
- **Codex end-of-turn capture.** The plan expected an asynchronous capture on Codex, and `adapters/codex/hooks/hooks.json` declares `Stop` without `async`. Whether Codex supports asynchronous hooks is not recorded in `docs/compatibility.md`.
- **Failure tests missing from the recorded strategy.** No test covers a malformed line in `corrections.jsonl`, a home store without write permission that falls back to `PLUGIN_DATA`, a missing Node.js or a process interrupted before an asynchronous capture (`docs/architecture.md`, "Test strategy"; `docs/risks.md`).
- **Coexistence with the ai-memory hooks.** No coexistence test exists, and S6 recorded hook failures that a single-plugin trace would still have to attribute (`docs/risks.md`).
- **Features the plan described that the code does not have.** `tutor doctor` does not report received payloads per client, and no preference forces the store location per client; only the `FLUENTDEV_BR_DATA` environment override exists.
