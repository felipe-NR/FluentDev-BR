# Architecture decision records

This directory is the single source of the project's decisions: why each one was taken and whether it still holds. The current state that each decision produced is in `docs/architecture.md` and `docs/product.md`.

## How to use

- Write a record here before or with the change that needs an architectural choice.
- Keep existing IDs. A new record takes the next four-digit number (`0002`, `0003` and so on).
- Use only the statuses Proposed, Accepted, Superseded and Deprecated.
- A superseded record stays and links to its successor. D1 to D12 live in a frozen plan, so for them the successor record and this index carry the link.
- When a decision is accepted, update the current document it affects and record the implementation in `docs/tasks.md`.
- Changing an accepted decision needs the repository owner's approval.
- ai-memory may keep a pointer to a record here, never a second copy.

## Index

|ID|decision|status|scope|
|-|-|-|-|
|[ADR-0001](0001-tutor-layers.md)|The tutor lives in the portable core, and hooks only trigger it|Accepted|Layers|
|[ADR-0002](0002-rename-to-fluentdev-br.md)|Rename the project and plugin to `FluentDev-BR` (`fluentdev-br` for machine identifiers)|Accepted|Naming|
|[D1](../implementation-plan.md#8-decisões)|MVP clients are Claude Code and Codex; Copilot CLI, VS Code, agy, Cursor and Kiro come after the MVP|Accepted|Scope|
|[D2](../implementation-plan.md#8-decisões)|The package lives in the `plugin/` subdirectory, so source and tests stay out of the client caches|Accepted|Packaging|
|[D3](../implementation-plan.md#8-decisões)|The package stays 100% within the spec: client-specific files only in a namespace, in `extensions` or outside the package|Accepted|Packaging|
|[D4](../implementation-plan.md#8-decisões)|One store per OS user, with a `PLUGIN_DATA` fallback that the client may remove on uninstall|Accepted|Storage|
|[D5](../implementation-plan.md#8-decisões)|Explanations in English, with a pt-BR note for false friends|Accepted|Pedagogy|
|[D6](../implementation-plan.md#8-decisões)|Messages written in Portuguese are ignored by default, with an optional `hint`|Accepted|Pedagogy|
|[D7](../implementation-plan.md#8-decisões)|TypeScript and Node.js: the reference MCP SDK and one bundle for every OS|Accepted|Runtime|
|[D8](../implementation-plan.md#8-decisões)|`plugin/dist/` is committed and checked in CI, because installs from git run no build|Accepted|Build|
|[D9](../implementation-plan.md#8-decisões)|The plugin is named `english-tutor-claudinho`, like the repository|Superseded by [ADR-0002](0002-rename-to-fluentdev-br.md)|Naming|
|[D10](../implementation-plan.md#8-decisões)|MIT license|Accepted|License|
|[D11](../implementation-plan.md#8-decisões)|Repository documentation in English with a short pt-BR section; the implementation plan stays in pt-BR|Accepted|Documentation|
|[D12](../implementation-plan.md#8-decisões)|Codex installs a legacy package generated in `adapters/codex/`, outside `plugin/`, until Codex loads hooks from Agent Plugins packages|Accepted|Clients|

## Migration

D1 to D12 were decided on 2026-09-13 and recorded in section 8 of `docs/implementation-plan.md` (pt-BR), where their text stays unchanged. On 2026-09-17 the plan became a frozen record, and this index took over their status. ADR-0001 records D12 in its 2026-09-13 update.
