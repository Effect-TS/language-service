// @strict
// @effect-diagnostics effectFnImplicitAny:error
import * as Effect from "effect/Effect"

// Should trigger - standalone Effect.fn generator callback falls back to any
export const standalone = Effect.fn("standalone")(function*(input) {
  return input
})

// Should trigger - standalone Effect.fn regular callback falls back to any
export const standaloneRegular = Effect.fn("standaloneRegular")((input) => Effect.succeed(input))

// Should trigger - standalone Effect.fnUntraced callback falls back to any
export const standaloneUntraced = Effect.fnUntraced(function*(input) {
  return input
})

// Should trigger - multiple params are all implicit any
export const multiple = Effect.fn(function*(a, b) {
  return [a, b] as const
})

// Should not trigger - outer contextual any matches normal noImplicitAny behavior
declare const acceptsAny: (f: (input: any) => Effect.Effect<any>) => void
acceptsAny(Effect.fn("acceptsAny")(function*(input) {
  return input
}))

// Should not trigger - outer contextual function type provides a concrete input type
declare const acceptsString: (f: (input: string) => Effect.Effect<number>) => void
acceptsString(Effect.fn("acceptsString")((input) => Effect.succeed(input.length)))

// Should not trigger - destructuring receives its type from the outer callback type
declare const acceptsRequest: (f: (input: { readonly id: string }) => Effect.Effect<string>) => void
acceptsRequest(Effect.fn("acceptsRequest")(function*({ id }) {
  return id
}))

// Should not trigger - explicit parameter types are already present
export const typed = Effect.fn("typed")((input: string) => Effect.succeed(input.length))
