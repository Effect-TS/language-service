import * as Effect from "effect/Effect"

// The diagnostic should NOT trigger for these cases because the function
// parameters are referenced in the piped transformations. Converting to
// Effect.fn would be unsafe since the parameters wouldn't be in scope
// after the transformation.

export const paramsInSpanAttributes = (a: number, b: string) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.withSpan("withParameters", { attributes: { a, b } }))
}

export const paramsInMapCallback = (a: number, b: string) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + a))
}

export const restParamsInPipe = (a: number, b: string, ...args: Array<number>) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + ":" + args.join(":")))
}

export const restParamElementInPipe = (a: number, b: string, ...args: Array<number>) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.map((_) => _ + ":" + args[0]))
}
