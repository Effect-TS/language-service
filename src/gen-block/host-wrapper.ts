/**
 * Language Service Host Wrapper for gen-block transformation
 *
 * Wraps the TypeScript language service host to transform gen {} blocks
 * before TypeScript parses them, enabling full IDE support with proper
 * position mapping.
 */

import type * as ts from "typescript"
import {
  cacheTransformation,
  clearCachedTransformation,
  getPositionMapper,
  isTransformedFile,
  mapOriginalToTransformed,
  mapTextSpan,
  mapTransformedToOriginal,
  type PositionMapper,
  type SourceMapData
} from "./position-mapper"
import { hasGenBlocks, transformSource } from "./transformer"

/**
 * Transformation state for a single file
 */
export interface TransformState {
  fileName: string
  originalSource: string
  transformedSource: string
  version: string
  mapper: PositionMapper
}

/**
 * Cache for script snapshots - keyed by fileName and version
 */
interface SnapshotCache {
  version: string
  originalSnapshot: ts.IScriptSnapshot
  transformedSnapshot: ts.IScriptSnapshot
}

/**
 * Options for creating a wrapped language service host
 */
export interface WrappedHostOptions {
  /** TypeScript instance */
  typescript: typeof ts
  /** Original language service host */
  host: ts.LanguageServiceHost
  /** Logger function */
  log?: (message: string) => void
}

/**
 * Result of creating a wrapped language service host
 */
export interface WrappedHostResult {
  /** The wrapped host that transforms gen blocks */
  wrappedHost: ts.LanguageServiceHost
  /** Get transform state for a file (if it was transformed) */
  getTransformState: (fileName: string) => TransformState | undefined
  /** Check if a file has been transformed */
  isTransformed: (fileName: string) => boolean
  /** Map a position from original to transformed */
  mapToTransformed: (fileName: string, position: number) => number
  /** Map a position from transformed to original */
  mapToOriginal: (fileName: string, position: number) => number
  /** Map a text span from transformed to original */
  mapSpanToOriginal: (fileName: string, span: ts.TextSpan) => ts.TextSpan
}

/**
 * Create a wrapped language service host that transforms gen blocks
 *
 * The wrapped host intercepts getScriptSnapshot() to provide transformed
 * source code to TypeScript while maintaining position mappings for
 * IDE features.
 */
export function createWrappedLanguageServiceHost(
  options: WrappedHostOptions
): WrappedHostResult {
  const { host, typescript: tsInstance } = options
  const log = options.log ?? (() => {})

  // IMPORTANT: Store reference to original getScriptSnapshot BEFORE any modifications
  // This prevents infinite recursion when the host's method is replaced
  const originalGetScriptSnapshot = host.getScriptSnapshot?.bind(host)

  // Cache for transformed snapshots
  const snapshotCache = new Map<string, SnapshotCache>()

  // Cache for transform states
  const transformStates = new Map<string, TransformState>()

  /**
   * Get the current version of a script
   */
  function getScriptVersion(fileName: string): string {
    return host.getScriptVersion?.(fileName) ?? "0"
  }

  /**
   * Process a file and potentially transform it
   */
  function processFile(fileName: string): TransformState | undefined {
    // Skip transformation for certain files
    if (
      fileName.includes("node_modules") ||
      fileName.endsWith(".d.ts") ||
      (!fileName.endsWith(".ts") && !fileName.endsWith(".tsx"))
    ) {
      return undefined
    }

    const version = getScriptVersion(fileName)

    // Check if we have a cached state with the same version
    const cachedState = transformStates.get(fileName)
    if (cachedState && cachedState.version === version) {
      return cachedState
    }

    // Get the original snapshot using the stored reference (avoids infinite recursion)
    const originalSnapshot = originalGetScriptSnapshot?.(fileName)
    if (!originalSnapshot) {
      return undefined
    }

    const originalSource = originalSnapshot.getText(0, originalSnapshot.getLength())

    // Check if transformation is needed
    if (!hasGenBlocks(originalSource)) {
      // Clear any stale cache
      transformStates.delete(fileName)
      snapshotCache.delete(fileName)
      clearCachedTransformation(fileName)
      return undefined
    }

    // Transform the source
    const result = transformSource(originalSource, fileName)

    if (!result.hasChanges || !result.map) {
      transformStates.delete(fileName)
      snapshotCache.delete(fileName)
      clearCachedTransformation(fileName)
      return undefined
    }

    // Cache the transformation for position mapping using the source map
    cacheTransformation(
      fileName,
      originalSource,
      result.code,
      result.map as SourceMapData
    )

    // Get the mapper
    const mapper = getPositionMapper(fileName)
    if (!mapper) {
      return undefined
    }

    // Create transform state
    const state: TransformState = {
      fileName,
      originalSource,
      transformedSource: result.code,
      version,
      mapper
    }

    transformStates.set(fileName, state)

    log(`[gen-block] Transformed: ${fileName} (v${version})`)

    return state
  }

  /**
   * Get a transformed snapshot for a file
   */
  function getTransformedSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    const version = getScriptVersion(fileName)

    // Check snapshot cache
    const cached = snapshotCache.get(fileName)
    if (cached && cached.version === version) {
      return cached.transformedSnapshot
    }

    // Process the file
    const state = processFile(fileName)
    if (!state) {
      // Not transformed - return original using stored reference
      snapshotCache.delete(fileName)
      return originalGetScriptSnapshot?.(fileName)
    }

    // Create transformed snapshot
    const transformedSnapshot = tsInstance.ScriptSnapshot.fromString(state.transformedSource)
    const originalSnapshot = originalGetScriptSnapshot?.(fileName)

    if (originalSnapshot) {
      snapshotCache.set(fileName, {
        version,
        originalSnapshot,
        transformedSnapshot
      })
    }

    return transformedSnapshot
  }

  // Create wrapped host using Proxy for proper method delegation
  const wrappedHost = new Proxy(host, {
    get(target, prop: string | symbol) {
      if (prop === "getScriptSnapshot") {
        return function(fileName: string) {
          return getTransformedSnapshot(fileName)
        }
      }

      if (prop === "readFile") {
        return function(fileName: string) {
          const state = processFile(fileName)
          if (state) {
            return state.transformedSource
          }
          return target.readFile?.(fileName)
        }
      }

      const value = target[prop as keyof ts.LanguageServiceHost]
      if (typeof value === "function") {
        return (value as Function).bind(target)
      }
      return value
    }
  })

  return {
    wrappedHost,

    getTransformState(fileName: string): TransformState | undefined {
      return transformStates.get(fileName)
    },

    isTransformed(fileName: string): boolean {
      return isTransformedFile(fileName)
    },

    mapToTransformed(fileName: string, position: number): number {
      return mapOriginalToTransformed(fileName, position)
    },

    mapToOriginal(fileName: string, position: number): number {
      return mapTransformedToOriginal(fileName, position)
    },

    mapSpanToOriginal(fileName: string, span: ts.TextSpan): ts.TextSpan {
      return mapTextSpan(fileName, span)
    }
  }
}
