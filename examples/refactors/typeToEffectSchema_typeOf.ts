// 6:21
import * as Schema from "effect/Schema"

const myVar = 'A' as const

export interface MyStruct {
    prop: typeof myVar
}
