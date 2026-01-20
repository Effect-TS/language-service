// 4:20
import * as Effect from "effect/Effect"

export class MyService extends Effect.Service<MyService>()("MyService", {
  succeed: { value: 42 }
}) {}
