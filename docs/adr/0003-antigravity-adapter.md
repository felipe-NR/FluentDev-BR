# ADR-0003: Antigravity CLI installs a native package generated in adapters/antigravity/

- Status: accepted
- Date: 2026-10-25
- Decider: Felipe Neves Ricardo
- Full analysis: [compatibility notes, spike S8](../compatibility.md#s8-antigravity-cli-147-spike)
- Predecessors: [ADR-0001](0001-tutor-layers.md), [D12](../implementation-plan.md#8-decisões)

## Context

The Antigravity CLI (`agy`) supports skills, hooks, and MCP servers in plugins.

Inspection and live spike testing against Antigravity CLI 1.4.7 (spike S8) revealed two loading constraints:

1. Runtime plugin discovery strictly reads `hooks.json` from the plugin root. It ignores namespaced hooks such as `extensions["com.google.antigravity"]` and `com.google.antigravity/hooks.json`.
2. When `plugin.json` declares the Agent Plugins 1.0.0 `$schema`, `agy` treats the package as an Agent Plugins package only while the internal feature flag `enable-agent-plugins-spec` is enabled (off by default in 1.4.7). Until that flag is enabled, `mcp.json` is ignored unless `mcp_config.json` also sits at the plugin root.
3. When `plugin.json` omits `$schema`, `agy` treats the directory as a native Antigravity plugin. It loads `hooks.json`, `mcp_config.json`, and `skills/` unconditionally, and `agy plugin validate adapters/antigravity --strict` passes with zero findings.

Per decision D3 and ADR-0001, `plugin/` is the canonical Agent Plugins 1.0.0 package and must stay 100% conformant to the specification. Non-portable root files like `hooks.json` and `mcp_config.json` cannot be placed inside `plugin/`.

## Decision

The build generates `adapters/antigravity/`, a native Antigravity package generated outside `plugin/`.

1. `plugin.json`: Native manifest without `$schema`, carrying `name`, `version`, and `description` copied from `plugin/plugin.json`.
2. `hooks.json`: Plugin-root hook definitions registering `SessionStart`, `PreInvocation`, and `Stop` with `command: "node dist/tutor.mjs hook antigravity <event>"` and `timeout: 30`.
3. `mcp_config.json`: Plugin-root MCP configuration launching `dist/tutor.mjs mcp` with `node`.
4. `skills/`, `dist/`, `LICENSE`: Copied from `plugin/`.
5. `scripts/antigravity-adapter.ts` generates the package, `scripts/check-antigravity-adapter.ts` guards it against drift in `npm run check`, and `adapters/antigravity/` is committed to git.

`plugin/` remains unchanged and 100% conformant to Agent Plugins 1.0.0.

## Consequences

- Antigravity CLI users install the package directly with `agy plugin install https://github.com/felipe-NR/FluentDev-BR/tree/main/adapters/antigravity` or from a local checkout with `agy plugin install ./adapters/antigravity`.
- Complete mode is supported on Antigravity CLI: `SessionStart` injects the protocol and briefing into conversation state, `PreInvocation` injects the per-turn reminder as an ephemeral message on each model invocation, and `Stop` captures corrections from the conversation transcript or `finalModelOutput`.
- The adapter can be retired once Antigravity CLI enables the Agent Plugins specification by default and supports lifecycle hooks in Agent Plugins packages.
