import * as Effect from "effect/Effect"
import * as Data from "effect/Data"

class ErrorA extends Data.Error<{
    a: 1
}>{}

class ErrorB extends Data.Error<{
    a: 2
}>{}

class ErrorC extends Data.Error<{
    a: 3
}>{}

declare const effectWithErrors: Effect.Effect<number, ErrorA | ErrorB | ErrorC>

export const noError: Effect.Effect<number> = Effect.succeed(1)

// @ts-expect-error
export const missingAllErrors: Effect.Effect<number> = effectWithErrors

// @ts-expect-error
export const missingErrorC: Effect.Effect<number, ErrorA | ErrorB> = effectWithErrors

export interface EffectSubtyping<A> extends Effect.Effect<A, ErrorA | ErrorB> {}

// @ts-expect-error
export const missingErrorCWithSubtyping: EffectSubtyping<number> = effectWithErrors

export function missingErrorWithGenericType<A>(error: A){
    // @ts-expect-error
    const missingErrorA: Effect.Effect<never> = Effect.fail(error)
    return missingErrorA
}
