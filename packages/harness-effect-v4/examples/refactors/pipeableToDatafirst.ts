// 5:16,14:16,20:16
import * as T from "effect/Effect"
import { pipe } from "effect/Function"

const test = pipe(
  T.succeed("Hello"),
  T.flatMap((_) => T.log(_)),
  T.andThen(T.succeed(42)),
  T.map((_) => _ * 2)
)

const noDataFirst = (value: string) => <A, E, R>(eff: T.Effect<A, E, R>) => pipe(eff, T.andThen(T.log(value)))

const test2 = pipe(
  T.succeed("Hello"),
  T.flatMap((_) => T.log(_)),
  noDataFirst("42")
)

const test3 = pipe(
  T.succeed("Hello"),
  T.flatMap((_) => T.log(_)),
  noDataFirst("a"),
  noDataFirst("b"),
  noDataFirst("c")
)
