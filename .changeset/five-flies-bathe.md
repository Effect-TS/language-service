---
"@effect/language-service": patch
---

Fix `getTypeAtLocation` to ignore type-only heritage expressions like `interface X extends Effect.Effect<...>` so the language service no longer triggers bogus TS2689 diagnostics.
