// @effect-diagnostics *:off
// @effect-diagnostics multipleEffectProvide:warning
import { Effect, Layer, Context } from "effect"

class A extends Context.Service<A>()("A", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
class B extends Context.Service<B>()("B", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
export const preview = Effect.void.pipe(Effect.provide(A.Default), Effect.provide(B.Default))
