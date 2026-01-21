// 7:12
import * as T from "effect/Effect"
import { pipe } from "effect/Function"

const test = pipe(
  T.succeed("Hello"),
  T.tap((_) => T.log(_))
)
