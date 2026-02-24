import * as Array from "effect/Array"
import * as Eq from "effect/Equivalence"
import type ts from "typescript"
import * as Nano from "../core/Nano"

const SymbolDisplayPartEq = Eq.make<ts.SymbolDisplayPart>((fa, fb) => fa.kind === fb.kind && fa.text === fb.text)

const JSDocTagInfoEq = Eq.make<ts.JSDocTagInfo>((fa, fb) =>
  fa.name === fb.name && typeof fa.text === typeof fb.text &&
  (typeof fa.text !== "undefined" ? Eq.Array(SymbolDisplayPartEq)(fa.text!, fb.text!) : true)
)

export function dedupeJsDocs(quickInfo: ts.QuickInfo | undefined): Nano.Nano<ts.QuickInfo | undefined> {
  if (!quickInfo) return Nano.succeed(quickInfo)
  if (quickInfo.tags) {
    return Nano.succeed({
      ...quickInfo,
      tags: Array.dedupeWith(quickInfo.tags, JSDocTagInfoEq)
    })
  }
  return Nano.succeed(quickInfo)
}
