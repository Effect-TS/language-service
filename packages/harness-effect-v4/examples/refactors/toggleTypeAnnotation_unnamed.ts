// 4:15
import * as Schema from "effect/Schema"

export const debug = Schema.Struct({
  id: Schema.Option(Schema.Number)
}).makeUnsafe
