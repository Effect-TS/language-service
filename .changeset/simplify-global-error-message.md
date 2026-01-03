---
"@effect/language-service": patch
---

Simplify diagnostic messages for global Error type usage

The diagnostic messages for `globalErrorInEffectCatch` and `globalErrorInEffectFailure` now use the more generic term "tagged errors" instead of "tagged errors (Data.TaggedError)" to provide cleaner, more concise guidance.
