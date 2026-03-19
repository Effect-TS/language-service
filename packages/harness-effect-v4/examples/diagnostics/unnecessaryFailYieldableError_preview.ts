// @effect-diagnostics *:off
// @effect-diagnostics unnecessaryFailYieldableError:warning
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

class Boom extends Data.TaggedError("Boom")<{}> {}
export const preview = Effect.gen(function*() {
  yield* Effect.fail(new Boom())
})
