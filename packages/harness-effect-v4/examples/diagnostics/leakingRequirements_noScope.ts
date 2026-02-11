import { ServiceMap } from "effect"
import type * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

export class FileSystem extends ServiceMap.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

interface LeakingScopeIsFine {
  writeCache: () => Effect.Effect<void, never, Scope.Scope>
  readCache: Effect.Effect<void, never, Scope.Scope>
}

export const GenericTag = ServiceMap.Service<LeakingScopeIsFine>("LeakingScopeIsFine")
