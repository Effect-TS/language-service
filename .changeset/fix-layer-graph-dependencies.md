---
"@effect/language-service": patch
---

Bug fix for layer graph: properly display dependencies when they reference themselves

The layer graph now correctly identifies and displays dependencies even when using type assignment compatibility (e.g., when a layer provides a base type and another layer requires a subtype).