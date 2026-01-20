import { Effect, Layer, pipe } from "effect"

class Database extends Effect.Service<Database>()("Database", {
  succeed: {}
}) {}

class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
  effect: Effect.as(Database, {})
}) {}

class EventsRepository extends Effect.Service<EventsRepository>()("EventsRepository", {
  effect: Effect.as(Database, {})
}) {}

class Analytics extends Effect.Service<Analytics>()("Analytics", {
  succeed: {}
}) {}

class UserService extends Effect.Service<UserService>()("UserService", {
  effect: Effect.as(Effect.zipRight(UserRepository, Analytics), {})
}) {}

class EventService extends Effect.Service<EventService>()("EventService", {
  effect: Effect.as(Effect.zipRight(EventsRepository, Analytics), {})
}) {}

class AppService extends Effect.Service<AppService>()("AppService", {
  effect: Effect.as(Effect.all([UserService, EventService]), {})
}) {}

const DatabaseLive = Database.Default

export const AppLive = pipe(
  DatabaseLive,
  Layer.provideMerge(UserRepository.Default),
  Layer.provideMerge(EventsRepository.Default),
  Layer.merge(Analytics.Default),
  Layer.provideMerge(UserService.Default),
  Layer.provideMerge(EventService.Default),
  Layer.provideMerge(AppService.Default)
)
