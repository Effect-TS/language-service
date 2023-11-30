// 4:32,6:32,8:32,12:18,16:18
import * as T from "effect/Effect"

export const test1 = () => T.succeed(42)

export const test2 = () => (true ? T.succeed(42) : false)

function sillyGenerics<A>(value: A) {
  return T.fail(value)
}

function removeAnnotation():number{
  return 42
}

function removeAnnotationWithSpace(): number {
  return 42
}
