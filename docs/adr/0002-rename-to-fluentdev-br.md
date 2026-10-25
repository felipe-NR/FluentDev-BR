# ADR-0002: Rename the project and plugin to FluentDev-BR

- Status: accepted
- Date: 2026-10-25
- Decider: Felipe Neves Ricardo
- Supersedes: [D9](../implementation-plan.md#8-decisões)

## Context

Decision D9 named the plugin and repository `english-tutor-claudinho`, and internal components used the `english-tutor` identifier and `ENGLISH_TUTOR_*` environment variables. The repository was renamed to `FluentDev-BR` (`github.com/felipe-NR/FluentDev-BR`).

The Agent Plugins 1.0.0 manifest schema (`plugin.schema.json`), npm package naming rules and the Agent Skills specification require lowercase identifiers for machine-facing package, plugin and skill names, while prose, titles, marketplace display names and the GitHub repository path use `FluentDev-BR`.

## Decision

1. Use `FluentDev-BR` for the repository name, documentation titles, prose and the Codex marketplace `displayName`.
2. Use `fluentdev-br` for machine identifiers: `package.json`, `plugin/plugin.json`, marketplace names and plugin entries, the Agent Skill directory and frontmatter (`plugin/skills/fluentdev-br/`), the MCP server name and config key, the MCP activation prompt (`fluentdev-br-on`), the MCP resource URI scheme (`fluentdev-br://`), the hook context tag (`[fluentdev-br]`), the per-user store directory (`~/.fluentdev-br`) and the `PLUGIN_DATA` fallback subdirectory (`$PLUGIN_DATA/fluentdev-br`).
3. Use `FLUENTDEV_BR_DATA` for the store directory override and `FLUENTDEV_BR_DISABLE` for the hook kill switch.

## Consequences

- Every active surface of the repository, package, skill, MCP server, hooks and user store shares the `FluentDev-BR` / `fluentdev-br` identity.
- Existing local stores under `~/.english-tutor-claudinho` are not read automatically; users who want to keep prior history move its contents to `~/.fluentdev-br`.
- `docs/implementation-plan.md` remains frozen with the original Phase 0 to 5 text.
