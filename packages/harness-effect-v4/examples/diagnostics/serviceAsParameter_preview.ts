// @effect-diagnostics *:off
// @effect-diagnostics serviceAsParameter:warning
import { Effect, ServiceMap } from "effect"

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<string>
}>()("Database") {}

declare const processOrder: (order: string, db: {
  readonly query: (sql: string) => Effect.Effect<string>
}) => Effect.Effect<void>

export const preview = Effect.gen(function*() {
  const db = yield* Database
  yield* processOrder("order-1", db)
})
