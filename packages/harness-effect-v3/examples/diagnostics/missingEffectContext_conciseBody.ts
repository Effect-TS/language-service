import * as Effect from "effect/Effect"

class ServiceA extends Effect.Service<ServiceA>()("ServiceA", {
  succeed: { a: 1 }
}) {}

declare const effectWithServices: Effect.Effect<number, never, ServiceA>

// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithServices
