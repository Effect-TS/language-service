---
"@effect/language-service": patch
---

Fix unwanted autocompletions inside import declarations

Previously, Effect.__, Option.__, and Either.__ completions were incorrectly suggested inside import statements. This has been fixed by detecting when the completion is requested inside an import declaration and preventing these completions from appearing.

Closes #541
