import * as Effect from "effect/Effect"

// Effect.fn with pipe transformations
export const effectFnWithMap = Effect.fn(function*() {
  return yield* Effect.succeed(42)
}, Effect.map((x) => x + 1))

export const effectFnWithMultipleTransformations = Effect.fn(
  function*() {
    return yield* Effect.succeed(42)
  },
  Effect.map((x) => x + 1),
  Effect.map((x) => x.toString()),
  Effect.map((x) => x.length > 0)
)

// Effect.fn with catchAll
export const effectFnWithCatchAll = Effect.fn(function*() {
  return yield* Effect.succeed(42)
}, Effect.catch(() => Effect.void))

// Traced Effect.fn with pipe transformations
export const tracedEffectFn = Effect.fn("traced")(function*() {
  return yield* Effect.succeed(42)
}, Effect.map((x) => x + 1))

// Effect.fnUntraced with pipe transformations
export const untracedEffectFn = Effect.fnUntraced(function*() {
  return yield* Effect.succeed(42)
}, Effect.map((x) => x + 1))

// Effect.fn with generator function arguments
export const effectFnWithArgs = Effect.fn(function*(n: number) {
  return yield* Effect.succeed(n * 2)
}, Effect.map((x) => x + 1))

// Effect.fn with generic type argument
export const effectFnWithGeneric = Effect.fn(function*<A>(value: A) {
  return yield* Effect.succeed(value)
}, Effect.map((x) => x))

// Effect.fn with constrained generic type argument
export const effectFnWithConstrainedGeneric = Effect.fn(function*<A extends string>(value: A) {
  return yield* Effect.succeed(value)
}, Effect.map((x) => x.length))
