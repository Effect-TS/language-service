---
"@effect/language-service": minor
---

Add new `schemaStructWithTag` diagnostic that suggests using `Schema.TaggedStruct` instead of `Schema.Struct` when a `_tag` field with `Schema.Literal` is present. This makes the tag optional in the constructor, improving the developer experience.

Example:
```typescript
// Before (triggers diagnostic)
export const User = Schema.Struct({
  _tag: Schema.Literal("User"),
  name: Schema.String,
  age: Schema.Number
})

// After (applying quick fix)
export const User = Schema.TaggedStruct("User", {
  name: Schema.String,
  age: Schema.Number
})
```

The diagnostic includes a quick fix that automatically converts the `Schema.Struct` call to `Schema.TaggedStruct`, extracting the tag value and removing the `_tag` property from the fields.
