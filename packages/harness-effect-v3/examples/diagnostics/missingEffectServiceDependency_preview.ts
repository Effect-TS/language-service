// @effect-diagnostics *:off
// @effect-diagnostics missingEffectServiceDependency:warning
import * as Effect from "effect/Effect"

class Db extends Effect.Service<Db>()("Db", { succeed: { ok: true } }) {}
export class Repo extends Effect.Service<Repo>()("Repo", {
  effect: Effect.gen(function*() {
    yield* Db
    return { all: Effect.succeed([] as Array<number>) }
  })
}) {}
