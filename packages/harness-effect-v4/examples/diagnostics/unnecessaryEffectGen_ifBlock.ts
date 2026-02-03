import * as Effect from "effect/Effect"

export const shouldNotTrigger = Effect.gen(function*() {
  const query = yield* Effect.succeed("")
  yield* Effect.annotateCurrentSpan("query", query)
  if (query.length < 3) {
    return yield* Effect.fail("query too short")
  }
  return yield* Effect.succeed(true)
})
