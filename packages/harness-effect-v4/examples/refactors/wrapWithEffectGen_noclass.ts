// 4:36
import { Effect, Context } from "effect"

export class Asd extends Context.Service<Asd>()("Asd", {
  make: Effect.succeed({})
}) {}
