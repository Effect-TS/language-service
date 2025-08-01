import * as Effect from "effect/Effect"

export function standardShouldAppear() {
  return 42
}

export const sample = Effect.gen(function*() {
  const n = Math.random()
  if (n < 0.5) {
    return yield* Effect.fail("Error")
  }
  return n
})

export const sampleFn = Effect.fn("sampleFn")(function*(
  _arg1: number,
  _arg2: string
) {
  const n = Math.random()
  if (n < 0.5) {
    return yield* Effect.fail("Error")
  }
  return n
})

export const sampleFnUntraced = Effect.fnUntraced(function*(_: boolean) {
  const n = Math.random()
  if (n < 0.5) {
    return yield* Effect.fail("Error")
  }
  return n
})

export const withInitializer = Effect.fnUntraced(function*(_: boolean, _withInitializer = () => true) {
  const n = Math.random()
  if (n < 0.5) {
    return yield* Effect.fail("Error")
  }
  return n
})
