// 4:21
import * as Schema from "effect/Schema"

export interface MyStruct {
    id: number
    name: string
    enabled: boolean
    pets: string[]
    surname?: string
    birthday: Date
    petsArray: Array<string>
    nullableProp: null
    undefinedProp: undefined
    bigintProp: bigint
    trueProp: true
    falseProp: false
    literalProp: "hello"
    numericLiteralProp: 42
    unionProp: string | boolean
    inlineStruct: {a: string, b: number}
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
interface MyType<A, B>{
    _A: A
    _B: B
}
