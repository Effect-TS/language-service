// 17:23,17:34,19:34,24:41
import { Effect, Layer, pipe } from "effect"

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

export const prepareSimple = UserRepository.Default

export const prepareWithPipe = pipe(
  UserRepository.Default,
  Layer.provideMerge(Cache.Default)
)

export const prepareSomewhatComplex = pipe(
  UserRepository.Default,
  Layer.provideMerge(Cache.Default),
  Layer.merge(DbConnection.Default)
)
