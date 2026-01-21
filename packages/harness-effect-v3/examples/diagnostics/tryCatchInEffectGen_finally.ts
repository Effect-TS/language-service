import * as Effect from "effect/Effect"

// we consider this fine because there is no error handling, just cleanup
export const shouldNotTrigger = Effect.gen(function*() {
  try {
    const result = yield* Effect.succeed(42)
    return result
  } finally {
    console.log("exit")
  }
})
