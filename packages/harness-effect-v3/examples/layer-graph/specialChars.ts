import { Layer } from "effect"
import * as Context from "effect/Context"

const MyTypeId: unique symbol = Symbol.for("x")
type MyTypeId = typeof MyTypeId

export interface IsGeneric<X> {
  readonly [MyTypeId]: MyTypeId
  readonly value: X
}

const WithSpecialChars = Context.GenericTag<IsGeneric<"With<Special>Chars#!">>("IsGeneric<WithSpecialChars>")
const withSpecialCharsLayer = Layer.succeed(WithSpecialChars, { value: "WithSpecialChars" } as any)

export const NoComment = withSpecialCharsLayer
