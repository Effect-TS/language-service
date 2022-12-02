// 5:16,7:7
import * as T from "@effect/io/Effect"
import { pipe } from "@fp-ts/data/Function"

const test = pipe(
  1,
  T.succeed,
  T.map(a => a * 1)
)
