---
"@effect/language-service": minor
---

Add plugin options to better control patched `tsc` behavior.

`ignoreEffectErrorsInTscExitCode` allows Effect diagnostics reported as errors to be ignored for exit-code purposes, and `skipDisabledOptimiziation` keeps disabled diagnostics eligible for comment-based overrides when patch mode is active.
