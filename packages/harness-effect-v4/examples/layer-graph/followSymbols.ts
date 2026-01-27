// @test-config { "layerGraphFollowDepth": 1 }
import { cacheWithFs, DbConnection, simplePipeIn, UserRepository } from "@/layer-graph/simple"
import { Layer } from "effect"

export const followSymbols = simplePipeIn.pipe(Layer.provide(DbConnection.Default))

export const moreComplex = UserRepository.Default.pipe(Layer.provide(cacheWithFs), Layer.merge(DbConnection.Default))
