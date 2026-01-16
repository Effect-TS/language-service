---
"@effect/language-service": minor
---

Add `schemaSyncInEffect` diagnostic that warns when using `Schema.decodeSync`, `Schema.decodeUnknownSync`, `Schema.encodeSync`, or `Schema.encodeUnknownSync` inside Effect generators (`Effect.gen`, `Effect.fn`, `Effect.fnUntraced`), suggesting the use of Effect-based alternatives (`Schema.decode`, `Schema.decodeUnknown`, `Schema.encode`, `Schema.encodeUnknown`) for properly typed `ParseError` in the error channel.

```ts
// Before - triggers diagnostic
const program = Effect.gen(function*() {
  const person = Schema.decodeSync(Person)(input)
  return person
})

// After - use Effect-based method
const program = Effect.gen(function*() {
  const person = yield* Schema.decode(Person)(input)
  return person
})
```

Also adds `findEnclosingScopes` helper to TypeParser for reusable scope detection logic.
