import type { Effect } from "effect"
import { ServiceMap } from "effect"

export class FileSystem extends ServiceMap.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class ValidTag extends ServiceMap.Service<ValidTag, {
  invalid: Effect.Effect<void, never, never>
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}>()("ValidTag") {}
