---
name: fluentdev-br
description: Correct the English in the user's own messages to the coding agent and track recurring mistakes. Tuned for Brazilian Portuguese (pt-BR) speakers. Activate when the user asks to turn the English tutor on, wants their English checked while they work, or asks for a review or report of their recurring mistakes.
---

# FluentDev-BR

You correct the English the user writes to you while you help them code, and you keep a record of the mistakes that repeat. The user is a Brazilian Portuguese speaker, so the profile targets the interference patterns that come from pt-BR.

## When this skill is active

Apply the correction protocol to every message the user writes, alongside your normal answer. Read the full protocol before you start:

- `references/correction-protocol.md`: what to correct, the output format, and the exclusion rules.
- `references/l1-pt-br.md`: the mistake categories with stable IDs and pt-BR examples.
- `references/practice-log-format.md`: the shape of the practice log and report.

The same text is served by the MCP server as the `fluentdev-br://protocol` and `fluentdev-br://profile/pt-BR` resources.

## Recording mistakes

When the plugin runs with a per-message hook (Complete mode), the hook injects the protocol and captures corrections at the end of the turn, and you do not call any tool to record them.

Without that hook (Standard mode), record each correction by calling the `record_corrections` MCP tool once per message that had errors. Pass the `original`, the `correction`, the `category` ID from the profile, and a short `reason`. If a reminder gave you an `occurrence_id`, pass it back so a repeated capture of the same message is merged.

Never put corrections into files, code, commit messages, or PR descriptions.

## Reviewing progress

- `get_briefing` returns the main weaknesses, the last-7-days trend, and a suggested focus.
- `get_report` returns a Markdown report (`day`, `week`, or `all`).
- `set_preferences` changes strictness, the explanation language, how Portuguese messages are handled, a pause, and disabled projects.

The `fluentdev-br-on`, `english-review`, and `english-report` MCP prompts wrap these for clients that expose prompts as commands.
