---
"@effect/language-service": patch
---

Fix `Refactor to Schema (Recursive Structural)` to support `exactOptionalPropertyTypes`

When `exactOptionalPropertyTypes` is enabled in tsconfig, optional properties with types like `string | undefined` are not assignable to types defined as `prop?: string`. This fix generates `Schema.optionalWith(Schema.String, { exact: true })` instead of `Schema.optional(Schema.Union(Schema.Undefined, Schema.String))` to maintain type compatibility with external libraries that don't always include `undefined` in their optional property types.

Example:
```typescript
// With exactOptionalPropertyTypes enabled
type User = {
  name?: string  // External library type (e.g., Stripe API)
}

// Generated schema now uses:
Schema.optionalWith(Schema.String, { exact: true })

// Instead of:
Schema.optional(Schema.Union(Schema.Undefined, Schema.String))
```

This ensures the generated schema maintains proper type compatibility with external libraries when using strict TypeScript configurations.
