import * as T from "@effect/io/Effect"

declare function getCallTrace(): string | undefined

export const sampleSucceed = <A>(value: A) => T.succeed(value)

export const sampleMap = <A, B>(f: (value: A) => B) => T.map(f)

const sampleFlatMap = <A, B>(f: (value: A) => T.Effect<never, never, B>) => T.flatMap(f)

function sampleDeclaration<A>(value: A): T.Effect<never, A, never> {
  const trace = getCallTrace()
  return T.fail(value)
}

function falsePositive() {
  return 42
}
