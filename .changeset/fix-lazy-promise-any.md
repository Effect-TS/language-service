---
"@effect/language-service": patch
---

Fix `lazyPromiseInEffectSync` false positives for `Effect.sync` thunks whose return type degrades to `any`. Promise detection now ignores `any` and `unknown` before falling back to assignability against the global `Promise` type.
