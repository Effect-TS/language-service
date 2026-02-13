import type { Effect } from "effect"
import { ServiceMap } from "effect"

export class FileSystem extends ServiceMap.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class LeakingDeps extends ServiceMap.Service<LeakingDeps, {
  writeCache: () => Effect.Effect<void, never, FileSystem>
  readCache: Effect.Effect<void, never, FileSystem>
}>()("LeakingDeps") {}

export function local() {
  class _LocalClass extends ServiceMap.Service<_LocalClass, {
    writeFile: (content: string) => Effect.Effect<void>
  }>()("LocalClass") {}

  class _LocalLeaking extends ServiceMap.Service<_LocalLeaking, {
    writeCache: () => Effect.Effect<void, never, FileSystem>
    readCache: Effect.Effect<void, never, FileSystem>
  }>()("LocalLeaking") {}
}
