# Practice log and report format

The plugin keeps a Markdown practice log as a reconstructible derivative of the append-only record. The report follows the same shape, filtered by period (`day`, `week`, or `all`).

## Sections

### Pattern Tracking

A table of the recurring mistake patterns, most frequent first. One row per `mistake_key` (category plus the normalized fragment).

| Column | Meaning |
|-|-|
| Category | the category ID from the pt-BR profile |
| Pattern | `original → correction` |
| Count | how many times the pattern was recorded |
| Last seen | date of the most recent occurrence |

### Daily Log

Grouped by day, most recent first. Each line is one recorded correction:

```
✏️ [category] "original" → "correction" (reason)
```

## Example

```markdown
# English practice log

## Pattern Tracking

| Category | Pattern | Count | Last seen |
|-|-|-|-|
| preposition | it depends of → it depends on | 4 | 2026-09-13 |
| doubt-question | I have a doubt → I have a question | 2 | 2026-09-12 |

## Daily Log

### 2026-09-13

✏️ [preposition] "it depends of the env" → "it depends on the env" ("depend" takes "on")

### 2026-09-12

✏️ [doubt-question] "I have a doubt" → "I have a question" (for "dúvida", use "question")
```

## Notes

- The log stores only the incorrect fragment (up to 160 characters) and its correction, never whole prompts, code blocks, or secrets.
- The log is regenerated from `corrections.jsonl`; editing it by hand has no lasting effect.
