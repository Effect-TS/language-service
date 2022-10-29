// 5:18
import * as T from "@effect/core/io/Effect"
import { pipe } from "@tsplus/stdlib/data/Function"

const test = T.map((a: number) => a * 2)(T.succeed(1))
