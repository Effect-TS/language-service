import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"

class ErrorA extends Data.TaggedClass("ErrorA")<{
  a: 1
}> {}

class ErrorB extends Data.TaggedClass("ErrorB")<{
  a: 2
}> {}

class ErrorC extends Data.TaggedClass("ErrorC")<{
  a: 3
}> {}

declare const effectWithErrors: Effect.Effect<number, ErrorA | ErrorB | ErrorC>

// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithErrors

// @ts-expect-error
export const conciseBody2: () => Effect.Effect<number, ErrorB> = () => effectWithErrors
