import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

class ServiceA extends Effect.Service<ServiceA>()("ServiceA", {
  succeed: { a: 1 }
}) {}

pipe(ServiceA, Effect.flatMap(() => Effect.void), Effect.runPromise)
