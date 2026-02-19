---
"@effect/language-service": patch
---

Performance improvements: replace `Nano.gen` with `Nano.fn` named functions across diagnostics, refactors, and code generation modules for better performance tracking and reduced runtime overhead. Add conditional `debugPerformance` flag to avoid unnecessary timing collection when not debugging.
