# backlog.md: possibilities after the MVP

This file lists possibilities after the MVP that nobody has assumed yet. An item becomes active work only when it moves to `docs/tasks.md`, and while it stays here it does not change the current state. The rules for these files are in `AGENTS.md`.

The items come from Phase 6 of `docs/implementation-plan.md`. That plan named the Copilot CLI and VS Code spike S5 and the Antigravity CLI spike S6, but `docs/compatibility.md` already uses S5 for the live real-model run and S6 for the Codex wiring audit, so here those spikes are S7 and S8.

## Learning features

- A spaced-repetition quiz built from the user's real mistakes.
- A weekly report. The `week` period of `tutor report` and `get_report` exists; the plan listed a weekly report as work after the MVP.
- More native-language profiles, such as a Korean profile after Luna's reference post. The current code fixes the categories and the profile resource to pt-BR (`docs/architecture.md`, "pt-BR profile").

## New clients

Each client enters after its own spike. The research done before the spikes is in section 3.4 of `docs/implementation-plan.md`.

- **S7, Copilot CLI and VS Code.** Both would share `com.github.copilot/hooks/hooks.json`, and the adapter would tell them apart by payload shape. The Copilot CLI documentation says it drops the output of file-based `userPromptSubmitted` hooks, so the plan predicted Standard mode for the Copilot CLI and Complete or Standard mode for VS Code.
- **Cursor and Kiro.**

## Packaging and distribution

- Remove the Claude Code marketplace entry when Claude Code implements Agent Plugins.
- A per-platform executable, for clients opened from a graphical interface where Node.js is not on the PATH.

## Community

- A proposal in the GitHub Discussions of the Agent Plugins spec, using the hook matrix as data. Publishing it needs the owner's explicit approval for that post.
