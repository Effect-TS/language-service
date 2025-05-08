import * as ReadonlyArray from "effect/Array"
import * as Eq from "effect/Equivalence"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "./core/AST.js"
import * as Nano from "./core/Nano.js"
import * as TypeCheckerApi from "./core/TypeCheckerApi.js"
import * as TypeScriptApi from "./core/TypeScriptApi.js"
import * as TypeParser from "./utils/TypeParser.js"

const SymbolDisplayPartEq = Eq.make<ts.SymbolDisplayPart>((fa, fb) =>
  fa.kind === fb.kind && fa.text === fb.text
)

const JSDocTagInfoEq = Eq.make<ts.JSDocTagInfo>((fa, fb) =>
  fa.name === fb.name && typeof fa.text === typeof fb.text &&
  (typeof fa.text !== "undefined" ? Eq.array(SymbolDisplayPartEq)(fa.text!, fb.text!) : true)
)

export function dedupeJsDocTags(quickInfo: ts.QuickInfo): ts.QuickInfo {
  if (quickInfo.tags) {
    return {
      ...quickInfo,
      tags: ReadonlyArray.dedupeWith(quickInfo.tags, JSDocTagInfoEq)
    }
  }
  return quickInfo
}

function formatTypeForQuickInfo(channelType: ts.Type, channelName: string) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const stringRepresentation = typeChecker.typeToString(
      channelType,
      undefined,
      ts.TypeFormatFlags.NoTruncation
    )
    return `type ${channelName} = ${stringRepresentation}`
  })
}

export function prependEffectTypeArguments(
  sourceFile: ts.SourceFile,
  position: number,
  quickInfo: ts.QuickInfo
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const hasTruncationHappened =
        ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1
      if (!hasTruncationHappened) return quickInfo

      const maybeNode = pipe(
        yield* AST.getAncestorNodesInRange(sourceFile, AST.toTextRange(position)),
        ReadonlyArray.head
      )
      if (Option.isNone(maybeNode)) return quickInfo
      const effectType = yield* TypeParser.effectType(
        typeChecker.getTypeAtLocation(maybeNode.value),
        maybeNode.value
      )

      const effectTypeArgsDocumentation: Array<ts.SymbolDisplayPart> = [{
        kind: "text",
        text: (
          "```ts\n" +
          "/* Effect Type Parameters */\n" +
          (yield* formatTypeForQuickInfo(effectType.A, "Success")) +
          "\n" +
          (yield* formatTypeForQuickInfo(effectType.E, "Failure")) +
          "\n" +
          (yield* formatTypeForQuickInfo(effectType.R, "Requirements")) +
          "\n```\n"
        )
      }]

      if (quickInfo.documentation) {
        return {
          ...quickInfo,
          documentation: effectTypeArgsDocumentation.concat(quickInfo.documentation)
        }
      }

      return {
        ...quickInfo,
        documentation: effectTypeArgsDocumentation
      }
    }),
    Nano.orElse(() => Nano.succeed(quickInfo))
  )
}
