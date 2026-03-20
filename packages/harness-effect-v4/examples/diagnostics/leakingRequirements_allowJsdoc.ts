import type { Effect } from "effect"
import { ServiceMap } from "effect"

export class FileSystem extends ServiceMap.Service<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>()("FileSystem") {}

export class Cache extends ServiceMap.Service<Cache, {
    writeFile: (content: string) => Effect.Effect<void>
  }>()("Cache") {}

// LeakingDeps is leaking FileSystem and Cache, but only Cache should be considered to be leaked

// @effect-expect-leaking FileSystem
export class LeakingDeps extends ServiceMap.Service<LeakingDeps, {
  writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
  readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("LeakingDeps") {}

// LeakingDeps2 is leaking FileSystem and Cache, but both are expected to be leaked

// @effect-expect-leaking FileSystem Cache
export class LeakingDeps2 extends ServiceMap.Service<LeakingDeps2, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("LeakingDeps2") {}

// LeakingDeps3 is leaking FileSystem and Cache, but both are expected to be leaked

/**
 * Example inside of a class with multiple JSDoc
 * @effect-leakable-service
 * @effect-expect-leaking FileSystem Cache
 */
export class LeakingDeps3 extends ServiceMap.Service<LeakingDeps3, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("LeakingDeps3") {}

// LeakingDeps4 is leaking FileSystem and Cache, but both are expected to be leaked

// @effect-expect-leaking FileSystem Cache
export const LeakingDeps4 = ServiceMap.Service<{
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>("LeakingDeps4")
