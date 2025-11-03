---
"@effect/language-service": minor
---

Add `schemaUnionOfLiterals` diagnostic to warn when using `Schema.Union` with multiple `Schema.Literal` calls that can be simplified to a single `Schema.Literal` call.

This diagnostic helps improve code readability and maintainability by suggesting a more concise syntax for union of literals.

Example:
```typescript
// ❌ Will trigger diagnostic
export const Status = Schema.Union(Schema.Literal("A"), Schema.Literal("B"))

// ✅ Simplified approach
export const Status = Schema.Literal("A", "B")
```
