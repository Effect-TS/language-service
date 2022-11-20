import * as T from "@effect/core/io/Effect"
import { pipe } from "@tsplus/stdlib/data/Function"

const test = pipe(
  T.succeed("Hello"),
  T.tap((_) => T.log(_))
)
