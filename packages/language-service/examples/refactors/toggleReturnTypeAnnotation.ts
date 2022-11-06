// 4:32,6:32,8:32
import * as T from "@effect/core/io/Effect"

export const test1 = () => T.succeed(42)

export const test2 = () => (true ? T.succeed(42) : false)

function sillyGenerics<A>(value: A) {
  return T.fail(value)
}
