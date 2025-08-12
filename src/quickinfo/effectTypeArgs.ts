import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export function effectTypeArgs(
  sourceFile: ts.SourceFile,
  position: number,
  quickInfo: ts.QuickInfo | undefined
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const typeParser = yield* Nano.service(TypeParser.TypeParser)
      const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

      // early exit
      if (options.quickinfoEffectParameters === "never") return quickInfo

      function formatTypeForQuickInfo(channelType: ts.Type, channelName: string) {
        const stringRepresentation = typeChecker.typeToString(
          channelType,
          undefined,
          ts.TypeFormatFlags.NoTruncation
        )
        return `type ${channelName} = ${stringRepresentation}`
      }

      function makeSymbolDisplayParts(title: string, A: ts.Type, E: ts.Type, R: ts.Type): Array<ts.SymbolDisplayPart> {
        return [{
          kind: "text",
          text: (
            "```ts\n" +
            "/* " + title + " */\n" +
            (formatTypeForQuickInfo(A, "Success")) +
            "\n" +
            (formatTypeForQuickInfo(E, "Failure")) +
            "\n" +
            (formatTypeForQuickInfo(R, "Requirements")) +
            "\n```\n"
          )
        }]
      }

      function getNodeForQuickInfo(node: ts.Node): ts.Node {
        if (ts.isNewExpression(node.parent) && node.pos === node.parent.pos) {
          return node.parent.expression
        }
        if (ts.isNamedTupleMember(node.parent) && node.pos === node.parent.pos) {
          return node.parent
        }
        if (ts.isJsxNamespacedName(node.parent)) {
          return node.parent
        }
        return node
      }

      function getDataForQuickInfo() {
        // NOTE: non-exposed API
        if (!("getTouchingPropertyName" in ts && typeof ts.getTouchingPropertyName === "function")) return

        const touchingNode = ts.getTouchingPropertyName(sourceFile, position) as ts.Node
        // if we are hovering the whole file, we don't do anything
        if (touchingNode === sourceFile) return
        const adjustedNode = getNodeForQuickInfo(touchingNode)
        // hover over a yield keyword
        if (ts.isToken(adjustedNode) && adjustedNode.kind === ts.SyntaxKind.YieldKeyword) {
          if (
            ts.isYieldExpression(adjustedNode.parent) && adjustedNode.parent.asteriskToken &&
            adjustedNode.parent.expression
          ) {
            // if we are hovering a yield keyword, we need to get the expression
            return {
              type: typeChecker.getTypeAtLocation(adjustedNode.parent.expression),
              atLocation: adjustedNode.parent.expression,
              node: adjustedNode.parent,
              shouldTry: true
            }
          }
        }
        // standard case
        return {
          type: typeChecker.getTypeAtLocation(adjustedNode),
          atLocation: adjustedNode,
          node: adjustedNode,
          shouldTry: options.quickinfoEffectParameters === "always" && quickInfo ? true : quickInfo &&
            ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1
        }
      }

      // check if we should try to get the effect type
      const data = getDataForQuickInfo()
      if (!(data && data.shouldTry)) return quickInfo
      const { atLocation, node, type } = data

      // first try to get the effect type
      const effectTypeArgsDocumentation = yield* pipe(
        typeParser.effectType(
          type,
          atLocation
        ),
        Nano.map((_) => makeSymbolDisplayParts("Effect Type Parameters", _.A, _.E, _.R)),
        Nano.orElse(() => {
          // if we have a call signature, we can get the effect type from the return type
          const callSignatues = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
          if (callSignatues.length !== 1) return Nano.succeed([])
          const returnType = typeChecker.getReturnTypeOfSignature(callSignatues[0])
          return pipe(
            typeParser.effectType(
              returnType,
              atLocation
            ),
            Nano.map((_) => makeSymbolDisplayParts("Returned Effect Type Parameters", _.A, _.E, _.R))
          )
        })
      )

      // there are cases where we create it from scratch
      if (!quickInfo) {
        const start = ts.getTokenPosOfNode(node, sourceFile)
        const end = node.end
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
