---
"@effect/language-service": patch
---

Optimize `getTypeAtLocation` usage to reduce unnecessary calls on non-expression nodes. This improves performance by ensuring type checking is only performed on expression nodes and adds additional null safety checks for symbol resolution.
