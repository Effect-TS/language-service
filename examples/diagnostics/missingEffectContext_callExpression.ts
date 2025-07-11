import * as Effect from "effect/Effect"

class ServiceA extends Effect.Service<ServiceB>()("ServiceA", {
  succeed: { a: 1 }
}) {}

class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
  succeed: { a: 2 }
}) {}

class ServiceC extends Effect.Service<ServiceB>()("ServiceC", {
  succeed: { a: 3 }
}) {}

declare const effectWithServices: Effect.Effect<number, never, ServiceA | ServiceB | ServiceC>

function testFn(effect: Effect.Effect<number>) {
  return effect
}

// @ts-expect-error
testFn(effectWithServices)

function testFnWithServiceAB(effect: Effect.Effect<number, never, ServiceA | ServiceB>) {
  return effect
}

// @ts-expect-error
testFnWithServiceAB(effectWithServices)
