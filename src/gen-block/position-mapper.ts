/**
 * Position mapping utilities for gen-block transformations
 *
 * Provides bidirectional position mapping between original source (with gen {})
 * and transformed source (with Effect.gen()).
 *
 * Uses a segment-based approach where each segment tracks a region of the source
 * and its corresponding position in the transformed output.
 */

import type * as ts from "typescript"

/**
 * A segment represents a contiguous region of source code and how it maps
 * between original and transformed coordinates.
 */
export interface Segment {
  /** Start position in original source */
  originalStart: number
  /** End position in original source */
  originalEnd: number
  /** Start position in transformed source */
  transformedStart: number
  /** End position in transformed source */
  transformedEnd: number
  /**
   * Whether this segment has 1:1 character mapping.
   * If true, positions within this segment can be mapped directly with offset.
   * If false, positions within map to the start of the transformed segment.
   */
  isIdentity: boolean
}

export interface TransformCacheEntry {
  /** Original source code (with gen {} syntax) */
  originalSource: string
  /** Transformed source code (with Effect.gen()) */
  transformedSource: string
  /** Ordered segments for position mapping */
  segments: Array<Segment>
}

/**
 * Position mapper using segment-based lookup
 */
export class PositionMapper {
  private readonly segments: ReadonlyArray<Segment>
  private readonly originalLength: number
  private readonly transformedLength: number

  constructor(
    segments: Array<Segment>,
    originalLength: number,
    transformedLength: number
  ) {
    // Sort by original position
    this.segments = [...segments].sort((a, b) => a.originalStart - b.originalStart)
    this.originalLength = originalLength
    this.transformedLength = transformedLength
  }

  /**
   * Map a position from original source to transformed source
   */
  originalToTransformed(pos: number): number {
    // Find the segment containing this position
    for (const seg of this.segments) {
      if (pos >= seg.originalStart && pos < seg.originalEnd) {
        if (seg.isIdentity) {
          // 1:1 mapping - calculate offset within segment
          const offset = pos - seg.originalStart
          return seg.transformedStart + offset
        } else {
          // Non-identity - map to start of transformed segment
          return seg.transformedStart
        }
      }
    }

    // Position is between segments or after all segments
    // Find cumulative offset from the last segment before this position
    let cumulativeOffset = 0
    for (const seg of this.segments) {
      if (seg.originalEnd <= pos) {
        // This segment is before our position - update cumulative offset
        cumulativeOffset = seg.transformedEnd - seg.originalEnd
      } else {
        break
      }
    }

    return pos + cumulativeOffset
  }

  /**
   * Map a position from transformed source back to original source
   */
  transformedToOriginal(pos: number): number {
    // Sort segments by transformed position for this lookup
    const byTransformed = [...this.segments].sort(
      (a, b) => a.transformedStart - b.transformedStart
    )

    // Find the segment containing this position
    for (const seg of byTransformed) {
      if (pos >= seg.transformedStart && pos < seg.transformedEnd) {
        if (seg.isIdentity) {
          // 1:1 mapping - calculate offset within segment
          const offset = pos - seg.transformedStart
          return seg.originalStart + offset
        } else {
          // Non-identity - map to start of original segment
          return seg.originalStart
        }
      }
    }

    // Position is between segments or after all segments
    let cumulativeOffset = 0
    for (const seg of byTransformed) {
      if (seg.transformedEnd <= pos) {
        cumulativeOffset = seg.transformedEnd - seg.originalEnd
      } else {
        break
      }
    }

    return pos - cumulativeOffset
  }

  /**
   * Get segments for debugging
   */
  getSegments(): ReadonlyArray<Segment> {
    return this.segments
  }
}

/**
 * Create segments from a gen block transformation
 *
 * This builds the mapping table by tracking how each part of the original
 * source maps to the transformed output.
 */
export function createSegmentsFromTransformation(
  originalSource: string,
  transformedSource: string,
  blocks: Array<{ start: number; end: number; braceStart: number }>
): Array<Segment> {
  const segments: Array<Segment> = []

  let origPos = 0
  let transPos = 0

  for (const block of blocks) {
    // 1. Content before this block (identity mapping)
    if (block.start > origPos) {
      const len = block.start - origPos
      segments.push({
        originalStart: origPos,
        originalEnd: block.start,
        transformedStart: transPos,
        transformedEnd: transPos + len,
        isIdentity: true
      })
      origPos = block.start
      transPos = transPos + len
    }

    // 2. The "gen {" -> "Effect.gen(/* __EFFECT_SUGAR__ */ function* () {" wrapper
    const genWrapperTransformed = "Effect.gen(/* __EFFECT_SUGAR__ */ function* () {"
    const origWrapperEnd = block.braceStart + 1
    const transWrapperEnd = transPos + genWrapperTransformed.length

    segments.push({
      originalStart: origPos,
      originalEnd: origWrapperEnd,
      transformedStart: transPos,
      transformedEnd: transWrapperEnd,
      isIdentity: false // Structural change, don't interpolate
    })

    origPos = origWrapperEnd
    transPos = transWrapperEnd

    // 3. Content inside the block - process line by line
    const contentEnd = block.end - 1 // Position of closing brace
    const originalContent = originalSource.slice(origPos, contentEnd)
    const lines = originalContent.split("\n")

    let lineOrigOffset = origPos
    let lineTransOffset = transPos

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ""
      const isLastLine = i === lines.length - 1
      const lineLen = line.length + (isLastLine ? 0 : 1) // +1 for newline except last

      // Check if this is a bind statement
      const trimmed = line.trim()
      const bindMatch = trimmed.match(/^(\w+|\[[\w\s,]+\])\s*<-\s*(.+)$/)

      if (bindMatch) {
        // Bind statement: "  x <- expr" -> "  const x = yield* expr"
        // We need to create segments that cover the ENTIRE line without gaps
        const indent = line.match(/^\s*/)?.[0] ?? ""
        const varPart = bindMatch[1] ?? ""
        const exprPart = bindMatch[2]?.replace(/;?\s*$/, "") ?? ""
        const hasSemi = trimmed.endsWith(";")

        const origLineStart = lineOrigOffset
        const transLineStart = lineTransOffset

        // Transformed line
        const transformedLine = `${indent}const ${varPart} = yield* ${exprPart}${hasSemi ? ";" : ""}`
        const transformedLineLen = transformedLine.length + (isLastLine ? 0 : 1)

        // Create fine-grained segments for precise position mapping
        // Original: "  user <- getUser(id);"
        // Transformed: "  const user = yield* getUser(id);"

        const arrowPos = line.indexOf("<-")
        let exprOrigStart = origLineStart + arrowPos + 2
        // Skip whitespace after arrow
        while (exprOrigStart < origLineStart + line.length) {
          const char = originalSource[exprOrigStart]
          if (char && /\s/.test(char)) {
            exprOrigStart++
          } else {
            break
          }
        }
        const exprOrigEnd = origLineStart + line.trimEnd().length - (hasSemi ? 1 : 0)

        // 1. Everything up to the expression (indent + var + arrow): non-identity
        //    This maps any position before the expression to the start of transformed line
        if (exprOrigStart > origLineStart) {
          segments.push({
            originalStart: origLineStart,
            originalEnd: exprOrigStart,
            transformedStart: transLineStart,
            transformedEnd: transLineStart + indent.length + 6 + varPart.length + 10, // up to "= yield* "
            isIdentity: false
          })
        }

        // 2. The expression itself: identity mapping
        const exprTransStart = transLineStart + indent.length + 6 + varPart.length + 10
        const exprTransEnd = exprTransStart + exprPart.length
        segments.push({
          originalStart: exprOrigStart,
          originalEnd: exprOrigEnd,
          transformedStart: exprTransStart,
          transformedEnd: exprTransEnd,
          isIdentity: true
        })

        // 3. Semicolon and newline: identity mapping
        if (exprOrigEnd < origLineStart + lineLen) {
          segments.push({
            originalStart: exprOrigEnd,
            originalEnd: origLineStart + lineLen,
            transformedStart: exprTransEnd,
            transformedEnd: transLineStart + transformedLineLen,
            isIdentity: true
          })
        }

        lineOrigOffset += lineLen
        lineTransOffset += transformedLineLen
      } else {
        // Unchanged line - identity mapping
        segments.push({
          originalStart: lineOrigOffset,
          originalEnd: lineOrigOffset + lineLen,
          transformedStart: lineTransOffset,
          transformedEnd: lineTransOffset + lineLen,
          isIdentity: true
        })

        lineOrigOffset += lineLen
        lineTransOffset += lineLen
      }
    }

    origPos = contentEnd
    transPos = lineTransOffset

    // 4. Closing brace "}" -> "})"
    segments.push({
      originalStart: contentEnd,
      originalEnd: block.end,
      transformedStart: transPos,
      transformedEnd: transPos + 2, // "})"
      isIdentity: false
    })

    origPos = block.end
    transPos = transPos + 2
  }

  // 5. Content after all blocks
  if (origPos < originalSource.length) {
    const remainingLen = originalSource.length - origPos
    segments.push({
      originalStart: origPos,
      originalEnd: originalSource.length,
      transformedStart: transPos,
      transformedEnd: transPos + remainingLen,
      isIdentity: true
    })
  }

  return segments
}

/**
 * Cache of transformed files for position mapping
 */
const transformCache = new Map<string, TransformCacheEntry>()

/**
 * Store a transformation result for later position mapping
 */
export function cacheTransformation(
  fileName: string,
  originalSource: string,
  transformedSource: string,
  blocks: Array<{ start: number; end: number; braceStart: number }>
): PositionMapper {
  const segments = createSegmentsFromTransformation(
    originalSource,
    transformedSource,
    blocks
  )

  transformCache.set(fileName, {
    originalSource,
    transformedSource,
    segments
  })

  return new PositionMapper(segments, originalSource.length, transformedSource.length)
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
  return new PositionMapper(cached.segments, cached.originalSource.length, cached.transformedSource.length)
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
