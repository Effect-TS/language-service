// @effect-diagnostics *:off
// @effect-diagnostics leakingRequirements:warning
import type { Effect } from "effect"
import { Context } from "effect"

class FileSystem extends Context.Service<FileSystem, {
  write: (s: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class Cache extends Context.Service<Cache, {
  read: Effect.Effect<string, never, FileSystem>
  save: () => Effect.Effect<void, never, FileSystem>
}>()("Cache") {}
