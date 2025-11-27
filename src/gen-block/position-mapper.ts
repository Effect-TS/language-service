/**
 * Position mapping utilities for gen-block transformations
 *
 * Uses @jridgewell/trace-mapping for accurate bidirectional position mapping
 * between original source (with gen {}) and transformed source (with Effect.gen()).
 *
 * The source map approach ensures that positions within expressions are
 * accurately mapped, fixing go-to-definition offset issues.
 */

import { generatedPositionFor, originalPositionFor, TraceMap } from "@jridgewell/trace-mapping"
import type * as ts from "typescript"

/**
 * Source map data structure from MagicString
 */
export interface SourceMapData {
  version: number
  file?: string
  sources: Array<string>
  sourcesContent?: Array<string | null>
  names: Array<string>
  mappings: string
}

export interface TransformCacheEntry {
  /** Original source code (with gen {} syntax) */
  originalSource: string
  /** Transformed source code (with Effect.gen()) */
  transformedSource: string
  /** Source map for position mapping */
  sourceMap: SourceMapData
  /** TraceMap instance for efficient lookups */
  tracer: TraceMap
  /** Filename for the source */
  filename: string
}

/**
 * Position mapper using source maps
 *
 * Provides accurate bidirectional position mapping using @jridgewell/trace-mapping.
 */
export class PositionMapper {
  private readonly tracer: TraceMap
  private readonly filename: string
  private readonly originalSource: string
  private readonly transformedSource: string

  constructor(
    sourceMap: SourceMapData,
    filename: string,
    originalSource: string,
    transformedSource: string
  ) {
    this.tracer = new TraceMap(sourceMap as any)
    this.filename = filename
    this.originalSource = originalSource
    this.transformedSource = transformedSource
  }

  /**
   * Convert an absolute position to line/column (1-based line, 0-based column)
   */
  private positionToLineColumn(source: string, pos: number): { line: number; column: number } {
    const lines = source.slice(0, pos).split("\n")
    return {
      line: lines.length,
      column: lines[lines.length - 1].length
    }
  }

  /**
   * Convert line/column to absolute position
   */
  private lineColumnToPosition(source: string, line: number, column: number): number {
    const lines = source.split("\n")
    let pos = 0
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1 // +1 for newline
    }
    return pos + column
  }

  /**
   * Map a position from original source to transformed source
   */
  originalToTransformed(pos: number): number {
    const { column, line } = this.positionToLineColumn(this.originalSource, pos)

    const generated = generatedPositionFor(this.tracer, {
      source: this.filename,
      line,
      column
    })

    if (generated.line === null || generated.column === null) {
      // Fallback: return the position as-is if no mapping found
      return pos
    }

    return this.lineColumnToPosition(this.transformedSource, generated.line, generated.column)
  }

  /**
   * Map a position from transformed source back to original source
   */
  transformedToOriginal(pos: number): number {
    const { column, line } = this.positionToLineColumn(this.transformedSource, pos)

    const original = originalPositionFor(this.tracer, { line, column })

    if (original.line === null || original.column === null) {
      // Fallback: return the position as-is if no mapping found
      return pos
    }

    return this.lineColumnToPosition(this.originalSource, original.line, original.column)
  }

  /**
   * Get the original source
   */
  getOriginalSource(): string {
    return this.originalSource
  }

  /**
   * Get the transformed source
   */
  getTransformedSource(): string {
    return this.transformedSource
  }
}

/**
 * Cache of transformed files for position mapping
 */
const transformCache = new Map<string, TransformCacheEntry>()

/**
 * Store a transformation result for later position mapping
 *
 * @param fileName - The file name
 * @param originalSource - Original source code
 * @param transformedSource - Transformed source code
 * @param sourceMap - Source map from MagicString
 */
export function cacheTransformation(
  fileName: string,
  originalSource: string,
  transformedSource: string,
  sourceMap: SourceMapData
): PositionMapper {
  const tracer = new TraceMap(sourceMap as any)

  transformCache.set(fileName, {
    originalSource,
    transformedSource,
    sourceMap,
    tracer,
    filename: sourceMap.sources[0] || fileName
  })

  return new PositionMapper(sourceMap, sourceMap.sources[0] || fileName, originalSource, transformedSource)
}

/**
 * Legacy cache function for backward compatibility
 * Creates a basic mapping when no source map is available
 */
export function cacheTransformationLegacy(
  fileName: string,
  originalSource: string,
  transformedSource: string,
  _blocks: Array<{ start: number; end: number; braceStart: number }>
): PositionMapper {
  // Create a minimal source map that maps everything 1:1
  // This won't provide accurate position mapping but maintains API compatibility
  const sourceMap: SourceMapData = {
    version: 3,
    sources: [fileName],
    sourcesContent: [originalSource],
    names: [],
    mappings: ""
  }

  return cacheTransformation(fileName, originalSource, transformedSource, sourceMap)
}

/**
 * Get cached transformation for a file
 */
export function getCachedTransformation(fileName: string): TransformCacheEntry | undefined {
  return transformCache.get(fileName)
}

/**
 * Get position mapper for a file
 */
export function getPositionMapper(fileName: string): PositionMapper | undefined {
  const cached = transformCache.get(fileName)
  if (!cached) return undefined
  return new PositionMapper(
    cached.sourceMap,
    cached.filename,
    cached.originalSource,
    cached.transformedSource
  )
}

/**
 * Clear cached transformation for a file
 */
export function clearCachedTransformation(fileName: string): void {
  transformCache.delete(fileName)
}

/**
 * Clear all cached transformations
 */
export function clearAllCachedTransformations(): void {
  transformCache.clear()
}

/**
 * Map a position from transformed code back to original code
 */
export function mapTransformedToOriginal(
  fileName: string,
  transformedPosition: number
): number {
  const mapper = getPositionMapper(fileName)
  if (!mapper) return transformedPosition
  return mapper.transformedToOriginal(transformedPosition)
}

/**
 * Map a position from original code to transformed code
 */
export function mapOriginalToTransformed(
  fileName: string,
  originalPosition: number
): number {
  const mapper = getPositionMapper(fileName)
  if (!mapper) return originalPosition
  return mapper.originalToTransformed(originalPosition)
}

/**
 * Map a text span from transformed code back to original code
 */
export function mapTextSpan(
  fileName: string,
  span: ts.TextSpan
): ts.TextSpan {
  const mapper = getPositionMapper(fileName)
  if (!mapper) return span

  const originalStart = mapper.transformedToOriginal(span.start)
  const originalEnd = mapper.transformedToOriginal(span.start + span.length)

  return {
    start: originalStart,
    length: Math.max(0, originalEnd - originalStart)
  }
}

/**
 * Map a text span from original code to transformed code
 */
export function mapTextSpanToTransformed(
  fileName: string,
  span: ts.TextSpan
): ts.TextSpan {
  const mapper = getPositionMapper(fileName)
  if (!mapper) return span

  const transformedStart = mapper.originalToTransformed(span.start)
  const transformedEnd = mapper.originalToTransformed(span.start + span.length)

  return {
    start: transformedStart,
    length: Math.max(0, transformedEnd - transformedStart)
  }
}

/**
 * Map diagnostic positions from transformed code back to original code
 */
export function mapDiagnosticPositions<D extends ts.Diagnostic>(
  diagnostics: ReadonlyArray<D>
): Array<D> {
  return diagnostics.map((diagnostic) => {
    if (!diagnostic.file || diagnostic.start === undefined) {
      return diagnostic
    }

    const fileName = diagnostic.file.fileName
    const mapper = getPositionMapper(fileName)
    if (!mapper) {
      return diagnostic
    }

    const originalStart = mapper.transformedToOriginal(diagnostic.start)
    const originalLength = diagnostic.length !== undefined
      ? mapper.transformedToOriginal(diagnostic.start + diagnostic.length) - originalStart
      : diagnostic.length

    return {
      ...diagnostic,
      start: originalStart,
      length: originalLength
    }
  })
}

/**
 * Check if a file has been transformed
 */
export function isTransformedFile(fileName: string): boolean {
  return transformCache.has(fileName)
}

/**
 * Get the original source for a transformed file
 */
export function getOriginalSource(fileName: string): string | undefined {
  return transformCache.get(fileName)?.originalSource
}

/**
 * Get the transformed source for a file
 */
export function getTransformedSource(fileName: string): string | undefined {
  return transformCache.get(fileName)?.transformedSource
}
