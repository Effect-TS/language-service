import { Layer, ServiceMap } from "effect"

const MyTypeId: unique symbol = Symbol.for("x")
type MyTypeId = typeof MyTypeId

export interface IsGeneric<X> {
  readonly [MyTypeId]: MyTypeId
  readonly value: X
}


declare const WithSpecialChars: ServiceMap.Service<IsGeneric<"With<Special>Chars#!">, { value: "WithSpecialChars" }>
const withSpecialCharsLayer = Layer.succeed(WithSpecialChars, { value: "WithSpecialChars" } as any)

export const NoComment = withSpecialCharsLayer
