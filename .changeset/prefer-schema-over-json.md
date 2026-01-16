---
"@effect/language-service": minor
---

Add `preferSchemaOverJson` diagnostic that suggests using Effect Schema for JSON operations instead of `JSON.parse`/`JSON.stringify` inside Effect contexts (`Effect.try`, `Effect.gen`, `Effect.fn`).

```ts
// Before - triggers diagnostic
const program = Effect.try(() => JSON.parse('{"name":"John"}'))

const program2 = Effect.gen(function*() {
  const parsed = JSON.parse('{"name":"John"}')
  return parsed
})

// After - use Effect Schema
import { Schema } from "effect"

const Person = Schema.Struct({ name: Schema.String })

const program = Schema.decode(Person)('{"name":"John"}')

const program2 = Effect.gen(function*() {
  const parsed = yield* Schema.decode(Person)('{"name":"John"}')
  return parsed
})
```
