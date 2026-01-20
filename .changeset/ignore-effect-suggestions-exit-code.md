---
"@effect/language-service": patch
---

Add `ignoreEffectSuggestionsInTscExitCode` option (default: `true`) to control whether Effect-related suggestions affect the TSC exit code. When enabled, suggestions won't cause `tsc` to return a non-zero exit code.
