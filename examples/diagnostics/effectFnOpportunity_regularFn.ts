import * as Effect from "effect/Effect"

export const shouldTrigger = () => {
  return Effect.succeed(1)
}

export const shouldTrigger2 = function<T>(value: T) {
  if (value === null) return Effect.fail("Error!")
  return Effect.succeed(value)
}

export function shouldTrigger3<T>(value: T) {
  if (value === null) return Effect.fail("Error!")
  return Effect.succeed(value)
}

export function shouldTrigger4<T>(value: T) {
  if (value === null) return Effect.fail("Error!")
  return Effect.gen(function*() {
    console.log("shouldTrigger as well!")
    return yield* Effect.succeed(value)
  })
}
