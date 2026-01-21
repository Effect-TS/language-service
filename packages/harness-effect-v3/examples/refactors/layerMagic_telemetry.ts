// 20:15
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  succeed: {}
}) {}
class Cache extends Effect.Service<Cache>()("Cache", {
  effect: Effect.as(FileSystem, {})
}) {}
class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
  effect: Effect.as(Effect.zipRight(HttpClient.HttpClient, Cache), {})
}) {}

const userRepositoryLayer = UserRepository.Default
const otlpLayer = Layer.effectDiscard(HttpClient.HttpClient)

export const Live = [userRepositoryLayer, otlpLayer, FetchHttpClient.layer] as any as Layer.Layer<any>
