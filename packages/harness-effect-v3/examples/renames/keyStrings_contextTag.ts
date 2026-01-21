// 4:20
import * as Context from "effect/Context"

export class MyClass extends Context.Tag("MyClass")<MyClass, {}>() {}
