/**
 * Core transformation module for Effect-TS gen block syntax
 *
 * Uses js-tokens based scanner for robust parsing.
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
 */

import MagicString from "magic-string"
import { findGenBlocks, hasGenBlocks, transformBlockContent } from "./scanner"

export { findGenBlocks, hasGenBlocks, transformBlockContent }

export interface GenBlock {
  start: number
  end: number
  content: string
}

export interface TransformResult {
  code: string
  map: ReturnType<MagicString["generateMap"]> | null
  hasChanges: boolean
  /** The MagicString instance for position mapping */
  magicString: MagicString | null
}

/**
 * Transform source code containing gen blocks
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
