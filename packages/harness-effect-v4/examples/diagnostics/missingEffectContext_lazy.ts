import {Effect, ServiceMap} from "effect"

class ServiceA extends ServiceMap.Service<ServiceA>()("ServiceA", {
  make: Effect.succeed({ a: 1 })
}) {}

export const useSpan: {
  <A, E, R>(evaluate: () => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
} = <A, E, R>(...args: [evaluate: () => Effect.Effect<A, E, R>]): Effect.Effect<A, E, R> => {
  const evaluate: () => Effect.Effect<A, E, R> = args[args.length - 1]
  return Effect.onExit(evaluate(), () => Effect.void)
}

export const useSpan_invalid: {
  <A, E, R>(evaluate: () => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
} = <A, E, R>(...args: [evaluate: () => Effect.Effect<A, E, R>]): Effect.Effect<A, E, R> => {
  const evaluate: () => Effect.Effect<A, E, R | ServiceA> = args[args.length - 1]
  // @ts-expect-error
  return Effect.onExit(evaluate(), () => Effect.void)
}
