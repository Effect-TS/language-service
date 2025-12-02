---
"@effect/language-service": patch
---

Fix symbol resolution for aliased module exports. The TypeParser now correctly handles cases where symbols are exported from a module with an alias, improving the accuracy of type analysis for Effect modules.
