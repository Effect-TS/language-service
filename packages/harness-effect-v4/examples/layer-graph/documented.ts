import { Effect, Layer, ServiceMap } from "effect"

/**
 * Manages database connections and pooling
 */
export class DbConnection extends ServiceMap.Service<DbConnection>()("DbConnection", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}

/**
 * Provides file system access for reading and writing files
 */
export class FileSystem extends ServiceMap.Service<FileSystem>()("FileSystem", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}

/**
 * In-memory caching layer for improved performance
 */
export class Cache extends ServiceMap.Service<Cache>()("Cache", {
  make: Effect.as(FileSystem.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}

/**
 * Repository for user data access and persistence
 */
export class UserRepository extends ServiceMap.Service<UserRepository>()("UserRepository", {
  make: Effect.as(Effect.andThen(DbConnection.asEffect(), Cache.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

/**
 * Provides cache with file system backing store
 */
export const CacheLive = Cache.Default.pipe(Layer.provide(FileSystem.Default))

/**
 * Complete application layer with all dependencies wired
 */
export const AppLive = UserRepository.Default.pipe(
  Layer.provideMerge(Cache.Default),
  Layer.provide(FileSystem.Default),
  Layer.provide(DbConnection.Default)
)
