import { Context, Effect, Layer } from "effect"

class ServiceA extends Context.Service<ServiceA>()("ServiceA", {
  make: Effect.succeed({ value: 1 })
}) {
  static Default = Layer.effect(this, this.make)
}

class ServiceB extends Context.Service<ServiceB>()("ServiceB", {
  make: Effect.succeed({ value: 2 })
}) {
  static Default = Layer.effect(this, this.make)
}

class ServiceC extends Context.Service<ServiceC>()("ServiceC", {
  make: Effect.succeed({ value: 3 })
}) {
  static Default = Layer.effect(this, this.make)
}

declare const layerWithServices: Layer.Layer<ServiceA, never, ServiceB | ServiceC>

function testFn(layer: Layer.Layer<ServiceA>) {
  return layer
}

// @ts-expect-error
testFn(layerWithServices)

function testFnWithServiceB(layer: Layer.Layer<ServiceA, never, ServiceB>) {
  return layer
}

// @ts-expect-error
testFnWithServiceB(layerWithServices)
