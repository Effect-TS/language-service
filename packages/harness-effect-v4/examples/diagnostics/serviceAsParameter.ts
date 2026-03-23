import { Effect, Layer, ServiceMap } from "effect"

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<string>
  readonly save: (data: string) => Effect.Effect<void>
}>()("Database") {}

class Logger extends ServiceMap.Service<Logger, {
  readonly info: (msg: string) => Effect.Effect<void>
}>()("Logger") {}

// Helper that takes a service shape as param (the antipattern)
declare const processOrder: (order: string, db: {
  readonly query: (sql: string) => Effect.Effect<string>
  readonly save: (data: string) => Effect.Effect<void>
}) => Effect.Effect<void>

// Helper that yields its own deps (the good pattern)
declare const processOrderGood: (order: string) => Effect.Effect<void, never, Database>

// Non-effect function
declare const serialize: (db: unknown) => string

// Should trigger - service yielded then passed to effectful callee
export const program1 = Effect.gen(function*() {
  const db = yield* Database
  yield* processOrder("order-1", db)
})

// Should trigger - multiple services passed
export const program2 = Effect.gen(function*() {
  const db = yield* Database
  const logger = yield* Logger
  yield* processOrder("order-2", db)
})

// Should NOT trigger - service used locally (property access)
export const program3 = Effect.gen(function*() {
  const db = yield* Database
  yield* db.query("SELECT 1")
})

// Should NOT trigger - service passed to non-effect function
export const program4 = Effect.gen(function*() {
  const db = yield* Database
  const _serialized = serialize(db)
})

// Should NOT trigger - service passed to Layer.succeed
export const program5 = Effect.gen(function*() {
  const db = yield* Database
  const _layer = Layer.succeed(Database, db)
})

// Should NOT trigger - non-service yield passed as arg
export const program6 = Effect.gen(function*() {
  const value = yield* Effect.succeed(42)
  yield* processOrderGood(String(value))
})

// Should NOT trigger - service used in Effect.fn (but used locally)
export const fn1 = Effect.fn("fn1")(function*() {
  const db = yield* Database
  return yield* db.query("SELECT 1")
})

// Should trigger - service passed in Effect.fn
export const fn2 = Effect.fn("fn2")(function*() {
  const db = yield* Database
  yield* processOrder("order-fn", db)
})
