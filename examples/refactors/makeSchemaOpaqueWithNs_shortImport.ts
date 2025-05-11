// 4:17
import { Schema } from "effect"

export const MyStruct = Schema.Struct({
    id: Schema.Number,
    name: Schema.String
})
