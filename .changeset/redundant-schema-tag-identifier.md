---
"@effect/language-service": minor
---

Add `redundantSchemaTagIdentifier` diagnostic that suggests removing redundant identifier arguments when they equal the tag value in `Schema.TaggedClass`, `Schema.TaggedError`, or `Schema.TaggedRequest`.

**Before:**
```typescript
class MyError extends Schema.TaggedError<MyError>("MyError")("MyError", {
  message: Schema.String
}) {}
```

**After applying the fix:**
```typescript
class MyError extends Schema.TaggedError<MyError>()("MyError", {
  message: Schema.String
}) {}
```

Also updates the completions to not include the redundant identifier when autocompleting `Schema.TaggedClass`, `Schema.TaggedError`, and `Schema.TaggedRequest`.
