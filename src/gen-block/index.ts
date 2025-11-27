/**
 * Gen-block syntax support for Effect-TS
 *
 * This module provides transformation and position mapping for the
 * ergonomic `gen {}` syntax that compiles to `Effect.gen()`.
 */

// Core transformation
export { findGenBlocks, hasGenBlocks, transformBlockContent, transformSource } from "./transformer"
export type { GenBlock, TransformResult } from "./transformer"

// Position mapping
export {
  cacheTransformation,
  clearAllCachedTransformations,
  clearCachedTransformation,
  createSegmentsFromTransformation,
  getCachedTransformation,
  getOriginalSource,
  getPositionMapper,
  getTransformedSource,
  isTransformedFile,
  mapDiagnosticPositions,
  mapOriginalToTransformed,
  mapTextSpan,
  mapTextSpanToTransformed,
  mapTransformedToOriginal,
  PositionMapper
} from "./position-mapper"
export type { Segment, TransformCacheEntry } from "./position-mapper"

// Language service host wrapper
export { createWrappedLanguageServiceHost } from "./host-wrapper"
export type { TransformState, WrappedHostOptions, WrappedHostResult } from "./host-wrapper"

// Type checking
export { checkFile, checkProject, createTransformingCompilerHost, fileHasGenBlocks } from "./type-checker"
export type { GenBlockDiagnostic, GenBlockTypeCheckerOptions, GenBlockTypeCheckResult } from "./type-checker"
