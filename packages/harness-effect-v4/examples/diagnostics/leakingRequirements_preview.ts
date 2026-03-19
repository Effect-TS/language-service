// @effect-diagnostics *:off
// @effect-diagnostics leakingRequirements:warning
import type { Effect } from "effect"
import { ServiceMap } from "effect"

class FileSystem extends ServiceMap.Service<FileSystem, {
  write: (s: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class Cache extends ServiceMap.Service<Cache, {
  read: Effect.Effect<string, never, FileSystem>
  save: () => Effect.Effect<void, never, FileSystem>
}>()("Cache") {}
