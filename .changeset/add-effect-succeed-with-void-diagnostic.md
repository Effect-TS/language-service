---
"@effect/language-service": minor
---

Add `effectSucceedWithVoid` diagnostic to suggest using `Effect.void` instead of `Effect.succeed(undefined)` or `Effect.succeed(void 0)`.

The diagnostic detects calls to `Effect.succeed` where the argument is exactly `undefined` or `void 0` (including parenthesized variants) and suggests replacing them with the more idiomatic `Effect.void`. A quick fix is provided to automatically apply the replacement.

Before:
```typescript
Effect.succeed(undefined)
Effect.succeed(void 0)
```

After:
```typescript
Effect.void
```
