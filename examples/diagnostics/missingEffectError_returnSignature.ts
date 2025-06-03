import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"

class ErrorA extends Data.Error<{
  a: 1
}> {}

class ErrorB extends Data.Error<{
  a: 2
}> {}

class ErrorC extends Data.Error<{
  a: 3
}> {}

declare const effectWithErrors: Effect.Effect<number, ErrorA | ErrorB | ErrorC>

export function testFn(): Effect.Effect<number> {
  // @ts-expect-error
  return effectWithErrors
}

// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithErrors

// @ts-expect-error
export const conciseBodyMissingServiceC: () => Effect.Effect<number, ErrorA | ErrorB> = () => effectWithErrors
