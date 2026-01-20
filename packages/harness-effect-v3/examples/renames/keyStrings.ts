// 4:20
import * as Context from "effect/Context"

export class MyService extends Context.Tag("MyService")<MyService, {
  hello: number
}>() {}
