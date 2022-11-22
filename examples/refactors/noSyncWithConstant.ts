//7:14
import * as Effect from "@effect/core/io/Effect"
import { pipe } from "@fp-ts/data/Function"


const result =  pipe(
    Effect.sync(() => "hello"),
    Effect.map((hello) => hello + ", world!"),
    Effect.flatMap((msg) => Effect.log(msg))
  )
