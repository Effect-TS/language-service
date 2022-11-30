// 5:18
import * as T from "@effect/io/Effect"
import { pipe } from "@fp-ts/data/Function"

const test = T.map((a: number) => a * 2)(T.succeed(1))
