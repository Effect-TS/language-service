// 4:30,4:36,10:61,10:67,19:10,19:16,26:99,26:104
import * as Eff from "effect/Effect"

export const program = () => Eff.gen(function* () {
    const a = yield* Eff.succeed(1)
    const b = yield* Eff.succeed(2)
    return a + b
  })

export const programWithPipes = (fa: number, fb: number) => Eff.gen(function* () {
    const a = yield* Eff.succeed(fa)
    const b = yield* Eff.succeed(fb)
    return a + b
}).pipe(
    Eff.map((a) => a + 1)
)

export function sampleReturns<A extends number, B extends number>(arg1: A, arg2: B) {
  return Eff.gen(function* () {
    const a = yield* Eff.succeed(arg1)
    const b = yield* Eff.succeed(arg2)
    return a + b
  })
}

export const sampleReturnsConciseBody = <A extends number, B extends number>(arg1: A, arg2: B) => Eff.gen(function* () {
  const a = yield* Eff.succeed(arg1)
  const b = yield* Eff.succeed(arg2)
  return a + b
})
