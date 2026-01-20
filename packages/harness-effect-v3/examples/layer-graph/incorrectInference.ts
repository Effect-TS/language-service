// This test shows incorrect effect usage, but is here just to test that the graph is properly using inference apis of ts
import { Layer } from "effect"
import * as Context from "effect/Context"

const UsersString = Context.GenericTag<"UsersString", string>("UsersString")
const GenericString = Context.GenericTag<string>("GenericString")

const providesStringLayer = Layer.succeed(GenericString, "John")
const requiresUser = Layer.effectDiscard(UsersString)

export const testInference = requiresUser.pipe(Layer.provide(providesStringLayer))
