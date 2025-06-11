// 9:21
import * as Schema from "effect/Schema"

const myVar = {
  a: 1,
  b: 2
} as const

export interface MyStruct {
  prop: (typeof myVar)[keyof typeof myVar]
}
