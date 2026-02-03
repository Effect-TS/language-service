import * as Effect from "effect/Effect"

export const noError = Effect.gen(function*() {
  yield* Effect.succeed(1)
})

export const missingStarInYield = Effect.gen(function*() {
  yield Effect.succeed(1)
})

export const missingStarInMultipleYield = Effect.gen(function*() {
  yield Effect.succeed(1)
  yield Effect.succeed(2)
})

export const missingStarInInnerYield = Effect.gen(function*() {
  yield* Effect.gen(function*() {
    yield Effect.succeed(1)
  })
})

export function* effectInsideStandardGenerator() {
  yield Effect.never
  // ^- this is fine, not inside an effect gen
}

export const effectFnUsage = Effect.fn(function*() {
  yield Effect.never
})

export const tracedEffectFnUsage = Effect.fn("tracedEffectFnUsage")(function*() {
  yield Effect.never
})

export const untracedEffectFnUsage = Effect.fnUntraced(function*() {
  yield Effect.never
})
