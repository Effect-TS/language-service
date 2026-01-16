---
"@effect/language-service": patch
---

Improved `effectFnOpportunity` diagnostic message to mention that Effect.fn accepts piped transformations as additional arguments when pipe transformations are detected.

When a function has `.pipe()` calls that would be absorbed by Effect.fn, the message now includes: "Effect.fn also accepts the piped transformations as additional arguments."
