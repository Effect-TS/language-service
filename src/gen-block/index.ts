/**
 * Gen-block syntax support for Effect-TS
 *
 * This module provides transformation and position mapping for the
 * ergonomic `gen {}` syntax that compiles to `Effect.gen()`.
 */

export { findGenBlocks, hasGenBlocks, transformBlockContent, transformSource } from "./transformer"
export type { GenBlock, TransformResult } from "./transformer"

export {
  cacheTransformation,
  clearAllCachedTransformations,
  clearCachedTransformation,
  getCachedTransformation,
  getOriginalSource,
  getTransformedSource,
  isTransformedFile,
  mapDiagnosticPositions,
  mapTextSpan,
  mapTransformedToOriginal
} from "./position-mapper"
export type { TransformCacheEntry } from "./position-mapper"

export { checkFile, checkProject, createTransformingCompilerHost, fileHasGenBlocks } from "./type-checker"
export type { GenBlockDiagnostic, GenBlockTypeCheckerOptions, GenBlockTypeCheckResult } from "./type-checker"
