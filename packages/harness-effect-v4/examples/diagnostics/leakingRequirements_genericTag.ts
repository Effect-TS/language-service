import type { Effect } from "effect"
import { Context } from "effect"

export class FileSystem extends Context.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

interface LeakingService {
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}

export const GenericTag = Context.Service<LeakingService>("LeakingService")
