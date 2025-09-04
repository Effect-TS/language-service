// 22:5
import type { Layer } from "effect"
import { Effect } from "effect"

class DbConnection extends Effect.Service<DbConnection>()("DbConnection", {
  succeed: {}
}) {}
class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  succeed: {}
}) {}
class Cache extends Effect.Service<Cache>()("Cache", {
  effect: Effect.as(FileSystem, {})
}) {}
class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
  effect: Effect.as(Effect.zipRight(DbConnection, Cache), {})
}) {}

export const prepareSomewhatComplex = [
  DbConnection.Default,
  Cache.Default,
  UserRepository.Default,
  FileSystem.Default
] as any as Layer.Layer<UserRepository | Cache>
