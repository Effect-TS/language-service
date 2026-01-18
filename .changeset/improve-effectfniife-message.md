---
"@effect/language-service": patch
---

Improve effectFnIife diagnostic message to suggest Effect.withSpan with the trace name when available

When `Effect.fn("traceName")` is used as an IIFE, the diagnostic now suggests using `Effect.gen` with `Effect.withSpan("traceName")` piped at the end to maintain tracing spans. For `Effect.fnUntraced`, it simply suggests using `Effect.gen` without the span suggestion.
