import type { Effect } from "effect"
import { Context } from "effect"

/**
 * @effect-leakable-service
 */
export class FileSystem extends Context.Tag("FileSystem")<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>() {}

interface LeakingService {
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}

export const GenericTag = Context.GenericTag<LeakingService>("LeakingService")
