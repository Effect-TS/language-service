/**
 * Token-based scanner for gen {} blocks using js-tokens
 *
 * Uses the battle-tested js-tokens package to properly handle:
 * - String literals (all types including template literals)
 * - Comments (single-line, multi-line, hashbang)
 * - Regex literals (correctly distinguished from division)
 * - All ECMAScript 2025 syntax
 */

import jsTokens, { type Token } from "js-tokens"

export interface GenBlock {
  /** Start position of 'gen' keyword */
  start: number
  /** End position (after closing brace) */
  end: number
  /** Content between braces (excluding braces) */
  content: string
  /** Position of opening brace */
  braceStart: number
}

export type TokenWithPosition = Token & {
  start: number
  end: number
}

/**
 * Tokenize source and add position information
 */
export function tokenize(source: string): Array<TokenWithPosition> {
  const tokens: Array<TokenWithPosition> = []
  let pos = 0

  for (const token of jsTokens(source)) {
    tokens.push({
      ...token,
      start: pos,
      end: pos + token.value.length
    } as TokenWithPosition)
    pos += token.value.length
  }

  return tokens
}

/**
 * Quick check if source contains gen blocks (fast path)
 */
export function hasGenBlocks(source: string): boolean {
  return /\bgen\s*\{/.test(source)
}

/**
 * Find all gen {} blocks in source using token-based parsing
 */
export function findGenBlocks(source: string): Array<GenBlock> {
  if (!hasGenBlocks(source)) {
    return []
  }

  const tokens = tokenize(source)
  const blocks: Array<GenBlock> = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Look for 'gen' identifier
    if (token.type !== "IdentifierName" || token.value !== "gen") {
      continue
    }

    // Find the next non-whitespace/comment token
    let j = i + 1
    while (j < tokens.length) {
      const nextToken = tokens[j]
      if (
        nextToken.type !== "WhiteSpace" &&
        nextToken.type !== "LineTerminatorSequence" &&
        nextToken.type !== "SingleLineComment" &&
        nextToken.type !== "MultiLineComment"
      ) {
        break
      }
      j++
    }

    // Check if it's followed by '{'
    if (j >= tokens.length) continue
    const braceToken = tokens[j]
    if (braceToken.type !== "Punctuator" || braceToken.value !== "{") {
      continue
    }

    // Found 'gen {', now find the matching '}'
    const genStart = token.start
    const braceStart = braceToken.start
    let depth = 1
    let k = j + 1

    while (k < tokens.length && depth > 0) {
      const t = tokens[k]
      if (t.type === "Punctuator") {
        if (t.value === "{") depth++
        if (t.value === "}") depth--
      }
      k++
    }

    if (depth === 0) {
      const endToken = tokens[k - 1]
      const end = endToken.end
      const content = source.slice(braceStart + 1, end - 1)

      blocks.push({
        start: genStart,
        end,
        content,
        braceStart
      })
    }
  }

  return blocks
}

/**
 * Check if a position is inside a nested function/callback
 * We want to transform binds inside control flow (if/else/try/catch)
 * but NOT inside nested functions/callbacks (different scope)
 */
function isInsideNestedFunction(tokens: Array<TokenWithPosition>, upToIndex: number): boolean {
  // Look for function or arrow function patterns before the current position
  // Track depth to find if we're inside a function body
  let functionDepth = 0

  for (let i = 0; i < upToIndex; i++) {
    const t = tokens[i]

    // Check for function keyword or arrow
    if (t.type === "IdentifierName" && t.value === "function") {
      // Found 'function', next '{' starts a function body
      for (let j = i + 1; j < upToIndex; j++) {
        if (tokens[j].type === "Punctuator" && tokens[j].value === "{") {
          functionDepth++
          break
        }
      }
    }

    // Check for arrow function: ) => {
    if (t.type === "Punctuator" && t.value === "=>") {
      // Look ahead for {
      for (let j = i + 1; j < upToIndex; j++) {
        const next = tokens[j]
        if (next.type === "Punctuator" && next.value === "{") {
          functionDepth++
          break
        }
        // If we hit something other than whitespace before {, it's expression arrow
        if (next.type !== "WhiteSpace" && next.type !== "LineTerminatorSequence") {
          break
        }
      }
    }

    // Track closing braces
    if (t.type === "Punctuator" && t.value === "}" && functionDepth > 0) {
      functionDepth--
    }
  }

  return functionDepth > 0
}

/**
 * Transform gen block content to Effect.gen body
 *
 * Transforms:
 * - `x <- expr` -> `const x = yield* expr` (anywhere except inside nested functions)
 *
 * Does NOT transform:
 * - let/const declarations (preserves them as-is)
 * - Binds inside nested functions/callbacks (they're a different scope)
 */
export function transformBlockContent(content: string): string {
  const tokens = tokenize(content)
  const lines = content.split("\n")
  const outputLines: Array<string> = []

  let lineStart = 0

  for (const line of lines) {
    const lineEnd = lineStart + line.length
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("//")) {
      outputLines.push(line)
      lineStart = lineEnd + 1 // +1 for newline
      continue
    }

    // Check if this line is inside a nested function/callback
    const firstTokenIndex = tokens.findIndex((t) => t.start >= lineStart && t.start < lineEnd)
    const insideNestedFunction = firstTokenIndex >= 0 ? isInsideNestedFunction(tokens, firstTokenIndex) : false

    // Transform bind statements unless inside a nested function
    if (!insideNestedFunction) {
      // Look for pattern: identifier <- expression
      // Supports: simple vars (x), array destructuring ([a, b]), object destructuring ({ a, b })
      const bindMatch = trimmed.match(/^(\w+|\[[\w\s,]+\]|\{[\w\s,:]+\})\s*<-\s*(.+)$/)

      if (bindMatch) {
        const [, varName, exprWithSemi] = bindMatch
        const indent = line.match(/^\s*/)?.[0] || ""
        const hasSemicolon = exprWithSemi.trimEnd().endsWith(";")
        const expression = exprWithSemi.replace(/;?\s*$/, "")

        outputLines.push(
          `${indent}const ${varName} = yield* ${expression}${hasSemicolon ? ";" : ""}`
        )
        lineStart = lineEnd + 1
        continue
      }
    }

    // Pass through unchanged
    outputLines.push(line)
    lineStart = lineEnd + 1
  }

  return outputLines.join("\n")
}
