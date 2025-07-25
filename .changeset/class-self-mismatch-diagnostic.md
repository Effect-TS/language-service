---
"@effect/language-service": minor
---

Add `classSelfMismatch` diagnostic rule

This new diagnostic rule checks that the Self type parameter in Effect.Service, Context.Tag, and Schema classes matches the actual class name. 

Example:
```typescript
// ❌ Error: Self type parameter should be 'MyService'
class MyService extends Effect.Service<WrongName>()("MyService", {
  succeed: { value: 1 }
}) {}

// ✅ Correct
class MyService extends Effect.Service<MyService>()("MyService", {
  succeed: { value: 1 }
}) {}
```

The diagnostic includes a quick fix to automatically correct the mismatch.