# product.md: FluentDev-BR

This file is the single source of product truth: what the plugin adds to a coding agent, for whom, the principles it keeps, the plug-and-play contract and the scope. The current architecture is in `docs/architecture.md`. The tutor behavior and privacy rules that contributors follow are in `AGENTS.md`. The history of the initial plan is in `docs/implementation-plan.md`.

## What the plugin adds

FluentDev-BR is a plugin that adds to a coding agent the ability to also act as an English teacher and tutor for Brazilian Portuguese speakers, by analyzing the messages the user writes. The agent keeps every ability it already has. It answers the coding request as usual, and when the prose in the user's message has English mistakes, it also corrects them, records the mistakes that repeat and reviews them with the user.

## For whom

Brazilian Portuguese speakers who write to coding agents in English. The mistake categories target the interference patterns that come from pt-BR, such as false friends, prepositions copied from Portuguese and a missing dummy subject ([`l1-pt-br.md`](../plugin/skills/fluentdev-br/references/l1-pt-br.md)).

## Principles kept from the reference design

The project builds on [Luna's Claude Code hooks setup](https://blog.stackademic.com/turning-my-coding-tool-into-an-english-tutor-with-claude-code-hooks-de3384f09b7f) and keeps three of its principles:

- The correction happens inside the tool the user already has open.
- Corrections are short: at most 3 lines.
- The model analyzes the raw messages, and no step depends on the user remembering to run a command.

| Aspect | Luna (reference) | This project |
|-|-|-|
| Speaker | Korean | Brazilian (pt-BR) |
| Client | Claude Code | Claude Code and Codex in the MVP, Antigravity CLI since 2026-10-25, other compatible clients later |
| Install | manual edit of `~/.claude/settings.json` | each client's native plugin command |
| Format | loose configuration | Agent Plugins 1.0.0 package |
| History | Markdown edited by the model | deterministic local record and a generated Markdown report |

The analysis of the reference design and of the limitations this project answers is in section 2 of `docs/implementation-plan.md`.

## Plug-and-play contract

1. The plugin installs with the client's native plugin command or its marketplace, without editing a configuration file by hand.
2. It needs no build on the user's machine. The only prerequisite is Node.js 22 or later on the PATH.
3. Uninstalling removes all behavior. The history in the main store stays until the user deletes it. When the CLI had to fall back to `${PLUGIN_DATA}`, the client may delete that directory on uninstall.
4. Consents the client requires, such as the Codex hook trust review, are documented and outside the plugin's control.

## Modes

What each mode requires from a client, and which client runs in which mode, is in `docs/architecture.md`.

| Mode | What the user gets |
|-|-|
| Complete | the protocol at session start, a short reminder on every message and automatic capture at the end of the turn |
| Standard | the user turns tutor mode on for the session, and the model records mistakes through an MCP tool |
| Minimal | corrections on demand, without history |

## Scope

- MVP clients: Claude Code and Codex.
- Post-MVP clients: Antigravity CLI, supported since 2026-10-25 (ADR-0003).
- Native-language profile: pt-BR.
- Out of scope: graphical interface, cloud sync, telemetry, and native-language profiles other than pt-BR.

Possibilities after the MVP are in `docs/backlog.md`.
