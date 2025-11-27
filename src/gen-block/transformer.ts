/**
 * Core transformation module for Effect-TS gen block syntax
 *
 * Uses fine-grained MagicString operations to preserve source map positions
 * for expression parts that don't change.
 *
 * Transforms:
 *   gen {
 *     user <- getUser(id)
 *     let name = user.name
 *     return { user, name }
 *   }
 *
 * Into:
 *   Effect.gen(function* () {
 *     const user = yield* getUser(id)
 *     let name = user.name
 *     return { user, name }
 *   })
 *
 * Note: Only bind arrows (x <- expr) are transformed to const.
 * Regular let/const declarations are preserved as-is to avoid
 * breaking nested callbacks that need reassignable variables.
 *
 * Position mapping strategy:
 * - Only modify the parts that change (gen keyword, bind arrows)
 * - Keep expression parts in place so their positions are preserved in source maps
 */

import MagicString from "magic-string"
import { findGenBlocks, hasGenBlocks, transformBlockContent } from "./scanner"

export { findGenBlocks, hasGenBlocks, transformBlockContent }

export interface GenBlock {
  start: number
  end: number
  content: string
  /** Position of opening brace */
  braceStart: number
}

export interface TransformResult {
  code: string
  map: ReturnType<MagicString["generateMap"]> | null
  hasChanges: boolean
  /** The MagicString instance for source map generation */
  magicString: MagicString | null
}

/**
 * Parse a bind statement and return its parts with positions
 */
interface BindStatement {
  /** Start of variable name (relative to content start) */
  varStart: number
  /** End of variable name (relative to content start) */
  varEnd: number
  /** The variable name or pattern */
  varName: string
  /** Start of arrow (relative to content start) */
  arrowStart: number
  /** End of arrow (relative to content start) */
  arrowEnd: number
  /** Start of expression (relative to content start) */
  exprStart: number
  /** End of expression (relative to content start) */
  exprEnd: number
  /** Whether there's a trailing semicolon */
  hasSemicolon: boolean
}

/**
 * Find bind statements in content with their positions
 */
function findBindStatements(content: string): Array<BindStatement> {
  const statements: Array<BindStatement> = []
  const lines = content.split("\n")
  let pos = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Match bind pattern: identifier <- expression
    // Supports: simple vars (x), array destructuring ([a, b]), object destructuring ({ a, b })
    const match = trimmed.match(/^(\w+|\[[\w\s,]+\]|\{[\w\s,:]+\})\s*<-\s*(.+)$/)

    if (match) {
      const indent = line.match(/^\s*/)?.[0] || ""
      const varName = match[1]
      const expr = match[2]

      // Calculate positions
      const varStart = pos + indent.length
      const varEnd = varStart + varName.length

      // Find arrow position
      const arrowIdx = line.indexOf("<-")
      const arrowStart = pos + arrowIdx
      const arrowEnd = arrowStart + 2

      // Find expression start (after arrow and any whitespace)
      const afterArrow = line.slice(arrowIdx + 2)
      const exprStartOffset = afterArrow.length - afterArrow.trimStart().length
      const exprStart = arrowEnd + exprStartOffset

      // Expression end (handle semicolon)
      const hasSemicolon = expr.trimEnd().endsWith(";")
      const exprEnd = pos + line.trimEnd().length - (hasSemicolon ? 1 : 0)

      statements.push({
        varStart,
        varEnd,
        varName,
        arrowStart,
        arrowEnd,
        exprStart,
        exprEnd,
        hasSemicolon
      })
    }

    pos += line.length + 1 // +1 for newline
  }

  return statements
}

/**
 * Check if a position in the content is inside a nested function/callback
 */
function isPositionInsideNestedFunction(content: string, position: number): boolean {
  const before = content.slice(0, position)
  let functionDepth = 0
  let i = 0

  while (i < before.length) {
    // Check for 'function' keyword
    if (before.slice(i).startsWith("function")) {
      const braceIdx = before.indexOf("{", i)
      if (braceIdx !== -1 && braceIdx < position) {
        functionDepth++
      }
      i += 8
      continue
    }

    // Check for arrow function =>
    if (before.slice(i).startsWith("=>")) {
      const afterArrow = before.slice(i + 2)
      const braceMatch = afterArrow.match(/^\s*\{/)
      if (braceMatch) {
        functionDepth++
      }
      i += 2
      continue
    }

    // Track closing braces
    if (before[i] === "}" && functionDepth > 0) {
      functionDepth--
    }

    i++
  }

  return functionDepth > 0
}

/**
 * Transform source code containing gen blocks
 *
 * Uses fine-grained MagicString operations to preserve source map positions
 * for expressions that don't change.
 */
export function transformSource(
  source: string,
  filename?: string
): TransformResult {
  if (!hasGenBlocks(source)) {
    return { code: source, map: null, hasChanges: false, magicString: null }
  }

  const blocks = findGenBlocks(source)
  if (blocks.length === 0) {
    return { code: source, map: null, hasChanges: false, magicString: null }
  }

  const s = new MagicString(source)

  // Process blocks from end to start to preserve positions
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    transformBlock(s, source, block)
  }

  const mapOptions: Parameters<MagicString["generateMap"]>[0] = {
    includeContent: true,
    hires: true
  }
  if (filename) {
    mapOptions.source = filename
    mapOptions.file = `${filename}.map`
  }

  return {
    code: s.toString(),
    map: s.generateMap(mapOptions),
    hasChanges: true,
    magicString: s
  }
}

/**
 * Transform a single gen block using fine-grained operations
 */
function transformBlock(s: MagicString, source: string, block: GenBlock): void {
  // 1. Replace "gen " (with trailing space) or "gen{" with the wrapper
  //    "Effect.gen(/* __EFFECT_SUGAR__ */ function* () "
  //    The opening brace { stays in place
  s.overwrite(block.start, block.braceStart, "Effect.gen(/* __EFFECT_SUGAR__ */ function* () ")

  // 2. Transform bind statements inside the block
  //    Only modify the parts that change, keeping expressions in place
  const contentStart = block.braceStart + 1
  const contentEnd = block.end - 1
  const content = source.slice(contentStart, contentEnd)

  const bindStatements = findBindStatements(content)

  // Process bind statements from end to start (to preserve positions)
  for (let i = bindStatements.length - 1; i >= 0; i--) {
    const bind = bindStatements[i]

    // Skip if inside a nested function
    if (isPositionInsideNestedFunction(content, bind.varStart)) {
      continue
    }

    // Convert positions to absolute (in source)
    const absVarStart = contentStart + bind.varStart
    const absVarEnd = contentStart + bind.varEnd
    const absExprStart = contentStart + bind.exprStart

    // Insert "const " before variable name
    s.appendLeft(absVarStart, "const ")

    // Replace from after variable to start of expression with " = yield* "
    // This preserves the variable name and expression in their original positions
    s.overwrite(absVarEnd, absExprStart, " = yield* ")
  }

  // 3. Add closing paren after the block's closing brace
  s.appendRight(block.end, ")")
}

/**
 * Legacy transform using content-based approach (for compatibility)
 * This version transforms the entire block content at once.
 */
export function transformSourceLegacy(
  source: string,
  filename?: string
): TransformResult {
  if (!hasGenBlocks(source)) {
    return { code: source, map: null, hasChanges: false, magicString: null }
  }

  const blocks = findGenBlocks(source)
  if (blocks.length === 0) {
    return { code: source, map: null, hasChanges: false, magicString: null }
  }

  const s = new MagicString(source)

  // Process blocks from end to start to preserve positions
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]

    // Transform the block content
    const transformedContent = transformBlockContent(block.content)

    // Build the replacement: Effect.gen(/* __EFFECT_SUGAR__ */ function* () { ... })
    // The marker comment identifies blocks that came from gen {} syntax
    const replacement = `Effect.gen(/* __EFFECT_SUGAR__ */ function* () {${transformedContent}})`

    // Replace the entire gen block
    s.overwrite(block.start, block.end, replacement)
  }

  const mapOptions: Parameters<MagicString["generateMap"]>[0] = {
    includeContent: true,
    hires: true
  }
  if (filename) {
    mapOptions.source = filename
    mapOptions.file = `${filename}.map`
  }

  return {
    code: s.toString(),
    map: s.generateMap(mapOptions),
    hasChanges: true,
    magicString: s
  }
}
