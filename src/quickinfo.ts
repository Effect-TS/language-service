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

export function dedupeJsDocTags(quickInfo: ts.QuickInfo | undefined): ts.QuickInfo | undefined {
  if (!quickInfo) return quickInfo
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
  quickInfo: ts.QuickInfo | undefined
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      // find the node we are hovering
      const maybeNode = pipe(
        yield* AST.getAncestorNodesInRange(sourceFile, AST.toTextRange(position)),
        ReadonlyArray.head
      )
      if (Option.isNone(maybeNode)) return quickInfo
      const node = maybeNode.value

      const hasTruncationHappened = quickInfo &&
        ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1

      // if we are hovering a "yield*" and there are no quickinfo,
      // we try to parse the effect type
      // otherwise if no truncation has happened, do nothing
      const nodeForType =
        (!quickInfo && ts.isYieldExpression(node) && node.asteriskToken && node.expression)
          ? node.expression
          : (hasTruncationHappened ? node : undefined)

      // we have no node to get type from
      if (!nodeForType) return quickInfo

      const effectType = yield* TypeParser.effectType(
        typeChecker.getTypeAtLocation(nodeForType),
        nodeForType
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

      // there are cases where we create it from scratch
      if (!quickInfo) {
        const start = node.getStart()
        const end = node.getEnd()
        return {
          kind: ts.ScriptElementKind.callSignatureElement,
          kindModifiers: "",
          textSpan: { start, length: end - start },
          documentation: effectTypeArgsDocumentation
        } satisfies ts.QuickInfo
      }

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
