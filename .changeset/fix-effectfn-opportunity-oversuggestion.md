---
"@effect/language-service": patch
---

Reduce over-suggestion of effectFnOpportunity diagnostic for regular functions.

The diagnostic now only suggests `Effect.fn` for regular functions (not using `Effect.gen`) when:
- The function has a block body (not a concise arrow expression)
- The function body has more than 5 statements

Functions using `Effect.gen` are still always suggested regardless of body size.
