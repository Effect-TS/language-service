import { Effect, Layer, Context } from "effect"

export class DbConnection extends Context.Service<DbConnection>()("DbConnection", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
export class FileSystem extends Context.Service<FileSystem>()("FileSystem", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
export class Cache extends Context.Service<Cache>()("Cache", {
  make: Effect.as(FileSystem.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}
export class UserRepository extends Context.Service<UserRepository>()("UserRepository", {
  make: Effect.as(Effect.andThen(DbConnection.asEffect(), Cache.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}
export const expect = UserRepository.Default

export const simplePipeIn = UserRepository.Default.pipe(Layer.provide(Cache.Default))

export const liveWithPipeable = UserRepository.Default.pipe(
  Layer.provideMerge(Cache.Default),
  Layer.merge(DbConnection.Default)
)

export const cacheWithFs = Cache.Default.pipe(Layer.provide(FileSystem.Default))
