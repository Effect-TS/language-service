// @effect-diagnostics importFromBarrel:error
import { Effect } from "effect"
import { Predicate as P } from "effect"
import * as Schema from "effect/Schema"

export const main = {
  a: Effect.void,
  b: P.isNumber,
  c: Schema.Number
}
