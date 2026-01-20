// 4:21
import * as Schema from "effect/Schema"

export interface MyStruct {
  anyProp: any
  bigintProp: bigint
  booleanProp: boolean
  neverProp: never
  nullProp: null
  numberProp: number
  stringProp: string
  undefinedProp: undefined
  unknownProp: unknown
  voidProp: void
  arrayTypeProp: Array<string>
  arrayProp: Array<string>
  dateProp: Date
  trueProp: true
  falseProp: false
  literalProp: "hello"
  numericLiteralProp: 42
  unionProp: string | boolean
  intersectionProp: { a: string } & { b: number }
  keyofProp: keyof { a: string; b: boolean }
  recordProp: Record<string, number>
  inlineStruct: { a: string; b: number }
  otherReference: MyUnion
  otherWithArguments: MyType<string, boolean>
  // single line comment
  prop: string
  /**
   * Multiline comment
   */
  prop2: string
}

type MyUnion = "A" | "B"
interface MyType<A, B> {
  _A: A
  _B: B
}
