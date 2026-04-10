import {Effect, Context} from "effect"
import { pipe } from "effect/Function"

class ServiceA extends Context.Service<ServiceA>()("ServiceA", {
  make: Effect.succeed({ a: 1 })
}) {}

// @ts-expect-error
pipe(ServiceA.asEffect(), Effect.flatMap(() => Effect.void), Effect.runPromise)
