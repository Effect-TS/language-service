// 5:16,14:16
import * as T from "@effect/io/Effect"
import { pipe } from "@fp-ts/data/Function"

const test = pipe(
  T.succeed("Hello"),
  T.flatMap(_ => T.log(_)),
  T.zipRight(T.succeed(42)),
  T.map(_ => _ * 2)
)

const noDataFirst = (value: string) => <R, E, A>(eff: T.Effect<R, E, A>) => pipe(eff, T.zipLeft(T.log(value)))

const test2 = pipe(
  T.succeed("Hello"),
  T.flatMap(_ => T.log(_)),
  noDataFirst("42")
)
