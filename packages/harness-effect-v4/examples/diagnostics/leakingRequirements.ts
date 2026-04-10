import type { Effect } from "effect"
import { Context } from "effect"

export class FileSystem extends Context.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class LeakingDeps extends Context.Service<LeakingDeps, {
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}>()("LeakingDeps") {}

export function local() {
  class _LocalClass extends Context.Service<_LocalClass, {
    writeFile: (content: string) => Effect.Effect<void>
  }>()("LocalClass") {}

  class _LocalLeaking extends Context.Service<_LocalLeaking, {
    writeCache: () => Effect.Effect<void, never, FileSystem>
    readCache: Effect.Effect<void, never, FileSystem>
  }>()("LocalLeaking") {}
}
