---
"@effect/language-service": patch
---

Extend `anyUnknownInErrorContext` diagnostic to also check Layer types

The `anyUnknownInErrorContext` diagnostic now checks both Effect and Layer types for `any` or `unknown` in their error and requirements channels. This helps catch more cases where type information is being lost in your Effect applications.

Example:
```typescript
const effectUnknown = Effect.context<unknown>()
const layerUnknown = Layer.effectDiscard(effectUnknown)
// Now reports: This has unknown in the requirements channel which is not recommended.
```

The diagnostic also now skips explicit Layer type annotations to avoid false positives on intentional type declarations.
