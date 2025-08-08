---
"@effect/language-service": patch
---

Fix auto-import barrel-to-barrel mapping for top-level named re-exports

When `topLevelNamedReexports` is set to "follow", the auto-import provider now correctly maps barrel exports to their barrel modules, ensuring proper import suggestions for re-exported functions like `pipe` from `effect/Function`.