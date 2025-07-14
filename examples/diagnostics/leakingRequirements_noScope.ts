import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

export class FileSystem extends Context.Tag("FileSystem")<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>() {}

interface LeakingScopeIsFine {
  writeCache: () => Effect.Effect<void, never, Scope.Scope>
  readCache: Effect.Effect<void, never, Scope.Scope>
}

export const GenericTag = Context.GenericTag<LeakingScopeIsFine>("LeakingScopeIsFine")
