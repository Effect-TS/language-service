import * as Effect from "effect/Effect"

const foo = () => Effect.succeed(100)
const bar = (x: number) => Effect.succeed(x + x)

export const program = Effect.gen(function*() {
  return yield* bar(yield* foo())
})
