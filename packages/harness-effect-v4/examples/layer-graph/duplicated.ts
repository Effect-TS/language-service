import { Effect, Layer, ServiceMap, pipe } from "effect"

class Database extends ServiceMap.Service<Database>()("Database", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}

class UserRepository extends ServiceMap.Service<UserRepository>()("UserRepository", {
  make: Effect.as(Database.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}

class EventsRepository extends ServiceMap.Service<EventsRepository>()("EventsRepository", {
  make: Effect.as(Database.asEffect(), {})
}) {
  static Default = Layer.effect(this, this.make)
}

class Analytics extends ServiceMap.Service<Analytics>()("Analytics", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}

class UserService extends ServiceMap.Service<UserService>()("UserService", {
  make: Effect.as(Effect.andThen(UserRepository.asEffect(), Analytics.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

class EventService extends ServiceMap.Service<EventService>()("EventService", {
  make: Effect.as(Effect.andThen(EventsRepository.asEffect(), Analytics.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

class AppService extends ServiceMap.Service<AppService>()("AppService", {
  make: Effect.as(Effect.andThen(UserService.asEffect(), EventService.asEffect()), {})
}) {
  static Default = Layer.effect(this, this.make)
}

export const AppLive = pipe(
  Database.Default,
  Layer.provideMerge(UserRepository.Default),
  Layer.merge(Analytics.Default),
  Layer.provideMerge(UserService.Default),
  Layer.merge(
    pipe(
      Database.Default,
      Layer.provideMerge(EventsRepository.Default),
      Layer.merge(Analytics.Default),
      Layer.provideMerge(EventService.Default)
    )
  ),
  Layer.provideMerge(AppService.Default)
)
