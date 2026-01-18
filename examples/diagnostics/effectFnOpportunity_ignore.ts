import * as Effect from "effect/Effect"

// This should be skipped because a and b are referenced in the piped transformations
export const shouldSkip = (a: number, b: string) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.withSpan("withParameters", { attributes: { a, b } }))
}

// This should be skipped because a is referenced inside the map transformation
export const shouldSkipRerence = (a: number, b: string) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + a))
}

// This should be skipped because args is referenced inside the map transformation
export const shouldSkipRerenceSpread = (a: number, b: string, ...args: Array<number>) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + ":" + args.join(":")))
}

// This should be skipped because args[0] is referenced inside the map transformation
export const shouldSkipRerenceSpreadArg0 = (a: number, b: string, ...args: Array<number>) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + ":" + args[0]))
}

// This should be skipped because of overloads
export function withOverloads(a: number): Effect.Effect<number>
export function withOverloads(a: string): Effect.Effect<string>
export function withOverloads(a: number | string) {
  return Effect.gen(function*() {
    return yield* Effect.succeed(a as any)
  })
}
