import type { Effect } from "effect"
import { ServiceMap } from "effect"

export class FileSystem extends ServiceMap.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

interface LeakingService {
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}

export const GenericTag = ServiceMap.Service<LeakingService>("LeakingService")
