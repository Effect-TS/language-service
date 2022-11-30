import * as T from "@effect/io/Effect"
import { pipe } from "@fp-ts/data/Function"

const test = pipe(
  T.succeed("Hello"),
  T.tap((_) => T.log(_))
)
