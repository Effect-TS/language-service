import type { Effect } from "effect"
import { Context } from "effect"

export class FileSystem extends Context.Tag("FileSystem")<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>() {}

export class ValidTag extends Context.Tag("ValidTag")<ValidTag, {
  invalid: Effect.Effect<void, never, never>
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}>() {}
