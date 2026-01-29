// 4:36
import { Effect, ServiceMap } from "effect"

export class Asd extends ServiceMap.Service<Asd>()("Asd", {
  make: Effect.succeed({})
}) {}
