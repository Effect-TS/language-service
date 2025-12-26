import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export function effectTypeArgs(
  sourceFile: ts.SourceFile,
  position: number,
  quickInfo: ts.QuickInfo | undefined
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
      const typeParser = yield* Nano.service(TypeParser.TypeParser)
      const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
      const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

      // early exit
      if (options.quickinfoEffectParameters === "never") return quickInfo

      function formatTypeForQuickInfo(channelType: ts.Type, channelName: string) {
        let stringRepresentation = ""
        if (options.quickinfoMaximumLength > 0) {
          const typeNode = typeChecker.typeToTypeNode(
            channelType,
            undefined,
            ts.NodeBuilderFlags.None,
            // @ts-expect-error
            undefined,
            undefined,
            options.quickinfoMaximumLength
          )
          const printer = ts.createPrinter({})
          stringRepresentation = typeNode ? printer.printNode(ts.EmitHint.Unspecified, typeNode, sourceFile) : ""
        } else {
          stringRepresentation = typeChecker.typeToString(channelType, undefined, ts.TypeFormatFlags.NoTruncation)
        }
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

      function isRightSideOfPropertyAccess(node: ts.Node): boolean {
        return node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
      }

      function isArgumentExpressionOfElementAccess(node: ts.Node): boolean {
        return node.parent && ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node
      }

      function isCalleeWorker<
        T extends
          | ts.CallExpression
          | ts.NewExpression
          | ts.TaggedTemplateExpression
          | ts.Decorator
          | ts.JsxOpeningLikeElement
      >(
        node: ts.Node,
        pred: (node: ts.Node) => node is T,
        calleeSelector: (node: T) => ts.Expression | ts.JsxTagNameExpression,
        includeElementAccess: boolean,
        skipPastOuterExpressions: boolean
      ) {
        let target = includeElementAccess ? climbPastPropertyOrElementAccess(node) : climbPastPropertyAccess(node)
        if (skipPastOuterExpressions) {
          target = tsUtils.skipOuterExpressions(target)
        }
        return !!target && !!target.parent && pred(target.parent) && calleeSelector(target.parent) === target
      }

      /** @internal */
      function climbPastPropertyAccess(node: ts.Node): ts.Node {
        return isRightSideOfPropertyAccess(node) ? node.parent : node
      }

      function climbPastPropertyOrElementAccess(node: ts.Node) {
        return isRightSideOfPropertyAccess(node) || isArgumentExpressionOfElementAccess(node) ? node.parent : node
      }

      function selectExpressionOfCallOrNewExpressionOrDecorator(
        node: ts.CallExpression | ts.NewExpression | ts.Decorator
      ) {
        return node.expression
      }

      function isCallExpressionTarget(
        node: ts.Node,
        includeElementAccess = false,
        skipPastOuterExpressions = false
      ): boolean {
        return isCalleeWorker(
          node,
          ts.isCallExpression,
          selectExpressionOfCallOrNewExpressionOrDecorator,
          includeElementAccess,
          skipPastOuterExpressions
        )
      }

      function isNewExpressionTarget(
        node: ts.Node,
        includeElementAccess = false,
        skipPastOuterExpressions = false
      ): boolean {
        return isCalleeWorker(
          node,
          ts.isNewExpression,
          selectExpressionOfCallOrNewExpressionOrDecorator,
          includeElementAccess,
          skipPastOuterExpressions
        )
      }

      function getSignatureForQuickInfo(location: ts.Node) {
        if (location.parent && location.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
          const right = (location.parent as ts.PropertyAccessExpression).name
          // Either the location is on the right of a property access, or on the left and the right is missing
          if (right === location || (right && right.getFullWidth() === 0)) {
            location = location.parent
          }
        }

        // try get the call/construct signature from the type if it matches
        let callExpressionLike:
          | ts.CallExpression
          | ts.NewExpression
          | ts.JsxOpeningLikeElement
          | ts.TaggedTemplateExpression
          | undefined
        if (ts.isCallOrNewExpression(location)) {
          callExpressionLike = location
        } else if (isCallExpressionTarget(location) || isNewExpressionTarget(location)) {
          callExpressionLike = location.parent as ts.CallExpression | ts.NewExpression
        }

        if (callExpressionLike) {
          const signature = typeChecker.getResolvedSignature(callExpressionLike)
          if (signature) {
            const returnType = typeChecker.getReturnTypeOfSignature(signature)
            if (returnType) {
              return {
                callExpressionLike,
                location,
                returnType
              }
            }
          }
        }
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
            const type = typeCheckerUtils.getTypeAtLocation(adjustedNode.parent.expression)
            if (type) {
              return {
                label: "Effect Type Parameters",
                type,
                atLocation: adjustedNode.parent.expression,
                node: adjustedNode.parent,
                shouldTry: true
              }
            }
          }
        }
        const nodeSignature = getSignatureForQuickInfo(adjustedNode)
        if (nodeSignature) {
          return {
            label: "Returned Effect Type Parameters",
            type: nodeSignature.returnType,
            atLocation: nodeSignature.location,
            node: nodeSignature.callExpressionLike,
            shouldTry: options.quickinfoEffectParameters === "always" && quickInfo ? true : quickInfo &&
              ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1
          }
        }
        // standard case
        const type = typeCheckerUtils.getTypeAtLocation(adjustedNode)
        if (type) {
          return {
            label: "Effect Type Parameters",
            type,
            atLocation: adjustedNode,
            node: adjustedNode,
            shouldTry: options.quickinfoEffectParameters === "always" && quickInfo ? true : quickInfo &&
              ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1
          }
        }
      }

      // check if we should try to get the effect type
      const data = getDataForQuickInfo()
      if (!(data && data.shouldTry)) return quickInfo
      const { atLocation, label, node, type } = data

      // first try to get the effect type
      const effectTypeArgsDocumentation = yield* pipe(
        typeParser.effectType(
          type,
          atLocation
        ),
        Nano.map((_) => makeSymbolDisplayParts(label, _.A, _.E, _.R))
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
