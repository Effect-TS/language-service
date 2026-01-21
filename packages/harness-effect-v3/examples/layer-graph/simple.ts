import { Effect, Layer } from "effect"

export class DbConnection extends Effect.Service<DbConnection>()("DbConnection", {
  succeed: {}
}) {}
export class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  succeed: {}
}) {}
export class Cache extends Effect.Service<Cache>()("Cache", {
  effect: Effect.as(FileSystem, {})
}) {}
export class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
  effect: Effect.as(Effect.zipRight(DbConnection, Cache), {})
}) {}

export const expect = UserRepository.Default

export const simplePipeIn = UserRepository.Default.pipe(Layer.provide(Cache.Default))

export const liveWithPipeable = UserRepository.Default.pipe(
  Layer.provideMerge(Cache.Default),
  Layer.merge(DbConnection.Default)
)

export const cacheWithFs = Cache.Default.pipe(Layer.provide(FileSystem.Default))
