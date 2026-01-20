---
"@effect/language-service": patch
---

Add `ignoreEffectWarningsInTscExitCode` option to allow Effect-related warnings to not affect the TSC exit code. When enabled, `tsc` will compile successfully even if Effect warnings are emitted. This is useful for CI/CD pipelines where Effect diagnostics should be informational rather than blocking.
