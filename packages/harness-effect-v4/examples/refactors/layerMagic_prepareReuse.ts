// 25:20,31:20
import { Effect, Layer, pipe, ServiceMap } from "effect"

class DbConnection extends ServiceMap.Service<DbConnection>()("DbConnection", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
class FileSystem extends ServiceMap.Service<FileSystem>()("FileSystem", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
class Cache extends ServiceMap.Service<Cache>()("Cache", {
  make: Effect.as(FileSystem.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}
class UserRepository extends ServiceMap.Service<UserRepository>()("UserRepository", {
  make: Effect.as(Effect.andThen(DbConnection.asEffect(), Cache.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

export const prepareUser_commentCache = pipe(
  UserRepository.Default,
  Layer.provide(Cache.Default),
  Layer.provide(FileSystem.Default)
)

export const prepareUserCache = pipe(
  UserRepository.Default,
  Layer.provideMerge(Cache.Default),
  Layer.provide(FileSystem.Default)
)
