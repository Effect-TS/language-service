// 4:19, 11:19
import * as Eff from "effect/Effect"

export const sampleReturnsConciseBody = <A extends number, B extends number>(arg1: A, arg2: B): Eff.Effect<number> =>
    Eff.gen(function*() {
      const a = yield* Eff.succeed(arg1)
      const b = yield* Eff.succeed(arg2)
      return a + b
    })

export const withGenerics = <A extends number, B>(a: A, b: B): Eff.Effect<A, B> =>
    Eff.gen(function*() {
        if(Math.random() > 0.5){
            return yield* Eff.fail(b)
        }
        return a
    })
