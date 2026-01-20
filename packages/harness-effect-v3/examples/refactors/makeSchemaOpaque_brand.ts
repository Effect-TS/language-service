// 4:17
import * as Schema from "effect/Schema"

export const ProductId = Schema.NonEmptyString.pipe(Schema.brand("ProductId"))
