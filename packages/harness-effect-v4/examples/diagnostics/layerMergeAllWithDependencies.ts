import { Effect, Layer, ServiceMap } from "effect"

export class DbConnection extends ServiceMap.Service<DbConnection>()("DbConnection", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
export class FileSystem extends ServiceMap.Service<FileSystem>()("FileSystem", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
export class Cache extends ServiceMap.Service<Cache>()("Cache", {
  make: Effect.as(FileSystem.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}
export class UserRepository extends ServiceMap.Service<UserRepository>()("UserRepository", {
  make: Effect.as(Effect.andThen(DbConnection.asEffect(), Cache.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

const cachePassthrough = Layer.effect(Cache, Cache.asEffect())

export const shouldNotWarn = Layer.mergeAll(
  DbConnection.Default,
  FileSystem.Default
)

export const shouldNotWarn2 = Layer.mergeAll(
  UserRepository.Default,
  cachePassthrough
)

export const shouldWarn = Layer.mergeAll(
  DbConnection.Default,
  FileSystem.Default,
  Cache.Default // <- this requires a DbConnection
)

export const shouldWarn2 = Layer.mergeAll(
  DbConnection.Default,
  FileSystem.Default,
  Cache.Default, // <- this requires a FileSystem,
  UserRepository.Default // <- this requires a DbConnection
)
