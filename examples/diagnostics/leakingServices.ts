import type { Effect } from "effect"
import { Context } from "effect"

export class FileSystem extends Context.Tag("FileSystem")<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>() {}

export class LeakingDeps extends Context.Tag("LeakingDeps")<LeakingDeps, {
  writeCache: Effect.Effect<void, never, FileSystem>
}>() {}

export function local() {
  class _LocalClass extends Context.Tag("FileSystem")<FileSystem, {
    writeFile: (content: string) => Effect.Effect<void>
  }>() {}
}
