// 4:15,6:15
import * as Schema from "effect/Schema"

export type Test = "a" | "b" | "c" | true | 42

export type NoLiteralOptimization = {a: boolean} | "a"
