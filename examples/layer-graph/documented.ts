import { Effect, Layer } from "effect"

/**
 * Manages database connections and pooling
 */
export class DbConnection extends Effect.Service<DbConnection>()("DbConnection", {
  succeed: {}
}) {}

/**
 * Provides file system access for reading and writing files
 */
export class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  succeed: {}
}) {}

/**
 * In-memory caching layer for improved performance
 */
export class Cache extends Effect.Service<Cache>()("Cache", {
  effect: Effect.as(FileSystem, {})
}) {}

/**
 * Repository for user data access and persistence
 */
export class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
  effect: Effect.as(Effect.zipRight(DbConnection, Cache), {})
}) {}

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
