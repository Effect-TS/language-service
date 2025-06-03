import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

// should not trigger
export const test: {
  <A, E, R>(eff: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>>
} = <A, E, R>(eff: Effect.Effect<A, E, R>) => {
  return Effect.void.pipe(Effect.andThen(eff), Effect.scoped)
}

// same as before
export const test2: {
  <A, E, R>(eff: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>>
} = <A, E, R>(eff: Effect.Effect<A, E, R>) => Effect.void.pipe(Effect.andThen(eff), Effect.scoped)

// should error
// @ts-expect-error
export const test3 = <A, E, R>(eff: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>> =>
  Effect.void.pipe(Effect.andThen(eff))
