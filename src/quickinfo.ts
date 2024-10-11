/**
 * @since 1.0.0
 */
import * as Eq from "effect/Equivalence"
import * as A from "effect/ReadonlyArray"
import type ts from "typescript"

const SymbolDisplayPartEq = Eq.make<ts.SymbolDisplayPart>((fa, fb) =>
  fa.kind === fb.kind && fa.text === fb.text
)

const JSDocTagInfoEq = Eq.make<ts.JSDocTagInfo>((fa, fb) =>
  fa.name === fb.name && typeof fa.text === typeof fb.text &&
  (typeof fa.text !== "undefined" ? Eq.array(SymbolDisplayPartEq)(fa.text!, fb.text!) : true)
)

/**
 * @since 1.0.0
 */
export function dedupeJsDocTags(quickInfo: ts.QuickInfo): ts.QuickInfo {
  if (quickInfo.tags) {
    return {
      ...quickInfo,
      tags: A.dedupeWith(quickInfo.tags, JSDocTagInfoEq)
    }
  }
  return quickInfo
}
