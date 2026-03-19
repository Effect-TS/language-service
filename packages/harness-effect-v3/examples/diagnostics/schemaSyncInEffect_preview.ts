// @effect-diagnostics *:off
// @effect-diagnostics schemaSyncInEffect:warning
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

const Person = Schema.Struct({ name: Schema.String, age: Schema.Number })

export const preview = Effect.gen(function*() {
  const input = yield* Effect.succeed({ name: "Ada", age: 1 })
  return Schema.decodeSync(Person)(input)
})
