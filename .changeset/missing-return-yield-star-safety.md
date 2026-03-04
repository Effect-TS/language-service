---
"@effect/language-service": patch
---

Improve `missingReturnYieldStar` safety by targeting only expression statements with top-level `yield*` expressions and validating the enclosing `Effect.gen` scope via `findEnclosingScopes`.

This avoids edge cases where nested or wrapped `yield*` expressions could be matched incorrectly.
