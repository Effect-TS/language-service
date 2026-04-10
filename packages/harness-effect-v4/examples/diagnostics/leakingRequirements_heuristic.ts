import type { Effect } from "effect"
import { Context } from "effect"

export class FileSystem extends Context.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class ValidTag extends Context.Service<ValidTag, {
  invalid: Effect.Effect<void, never, never>
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}>()("ValidTag") {}
