// 5:16
import * as T from "@effect/core/io/Effect"
import { pipe } from "@tsplus/stdlib/data/Function"

const test = pipe(
  1,
  T.succeed,
  T.map(a => a * 1)
)
