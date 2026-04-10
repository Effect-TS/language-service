import {Effect, Context} from "effect"

class ServiceA extends Context.Service<ServiceA>()("ServiceA", {
  make: Effect.succeed({ a: 1 })
}) {}

declare const effectWithServices: Effect.Effect<number, never, ServiceA>

// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithServices
