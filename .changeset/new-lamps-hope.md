---
"@effect/language-service": minor
---

Add refactor remove-unnecessary-effect-gen. This removes unnecessary `Effect.gen` calls by simplifying generator functions that only wrap a single `yield*` statement returning an `Effect`. This refactor replaces the `Effect.gen` wrapper with the inner `Effect` directly, making the code more concise and readable.
