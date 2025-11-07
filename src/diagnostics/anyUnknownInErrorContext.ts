import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const anyUnknownInErrorContext = LSP.createDiagnostic({
  name: "anyUnknownInErrorContext",
  code: 28,
  severity: "off",
  apply: Nano.fn("anyUnknownInErrorContext.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const isAnyOrUnknown = (type: ts.Type) =>
      (type.flags & ts.TypeFlags.Any) > 0 || (type.flags & ts.TypeFlags.Unknown) > 0

    // Store nodes that match the diagnostic criteria
    const matchingNodes: Array<{ node: ts.Node; type: ts.Type; messageText: string }> = []

    // Traverse all nodes in the source file
    const nodeToVisit: Array<ts.Node> = [sourceFile]
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.pop()!
      // skip for type nodes
      if (ts.isTypeNode(node)) continue
      if (ts.isTypeAliasDeclaration(node)) continue
      if (ts.isInterfaceDeclaration(node)) continue
      // skip when user says "as any"
      if (ts.isAsExpression(node) && node.type && node.type.kind === ts.SyntaxKind.AnyKeyword) {
        continue
      }
      // if this is a parameter or variable declaration, with explicit expected effect, skip
      if (ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) {
        if (node.type) {
          const type = typeChecker.getTypeAtLocation(node.type)
          const expectedEffect = yield* pipe(
            typeParser.strictEffectType(type, node.type),
            Nano.orElse(() => Nano.void_)
          )
          if (expectedEffect) continue
        }
      }
      // process children
      ts.forEachChild(node, appendNodeToVisit)

      // Get type at location
      if (!ts.isExpression(node)) continue
      let type = typeChecker.getTypeAtLocation(node)
      if (ts.isCallExpression(node)) {
        const resolvedSignature = typeChecker.getResolvedSignature(node)
        if (resolvedSignature) {
          type = typeChecker.getReturnTypeOfSignature(resolvedSignature)
        }
      }
      if (!type) continue

      // Check if it's an Effect type using typeParser
      yield* pipe(
        typeParser.strictEffectType(type, node),
        Nano.map((effect) => {
          const { E, R } = effect

          // Check if requirements type or error type is any or unknown
          const hasAnyUnknownR = isAnyOrUnknown(R)
          const hasAnyUnknownE = isAnyOrUnknown(E)

          if (hasAnyUnknownR || hasAnyUnknownE) {
            const channels: Array<string> = []
            if (hasAnyUnknownR) {
              const typeName = R.flags & ts.TypeFlags.Any ? "any" : "unknown"
              channels.push(`${typeName} in the requirements channel`)
            }
            if (hasAnyUnknownE) {
              const typeName = E.flags & ts.TypeFlags.Any ? "any" : "unknown"
              channels.push(`${typeName} in the error channel`)
            }

            const nodeStart = ts.getTokenPosOfNode(node, sourceFile)
            const nodeEnd = node.end

            // Remove any parent nodes that overlap with the current node's range
            // Since we traverse from outermost to innermost, any existing matching node
            // whose range contains the current node should be removed
            for (let i = matchingNodes.length - 1; i >= 0; i--) {
              const existing = matchingNodes[i]
              const existingStart = ts.getTokenPosOfNode(existing.node, sourceFile)
              const existingEnd = existing.node.end

              // Check if ranges overlap: existing node contains current node
              if (existingStart <= nodeStart && existingEnd >= nodeEnd) {
                matchingNodes.splice(i, 1)
              }
            }

            const suggestions: Array<string> = [`This Effect has ${channels.join(" and ")} which is not recommended.`]
            if (hasAnyUnknownR) {
              suggestions.push(`Only service identifiers should appear in the requirements channel.`)
            }
            if (hasAnyUnknownE) {
              suggestions.push(
                `Having an unknown or any error type is not useful. Consider instead using specific error types baked by Data.TaggedError for example.`
              )
            }

            channels.push(`If you plan to later on manually cast the type, you can safely disable this diagnostic.`)
            const messageText = suggestions.join("\n")
            matchingNodes.push({ messageText, node, type })
          }
        }),
        Nano.ignore
      )
    }

    // Report all the innermost nodes
    for (const { messageText, node } of matchingNodes) {
      report({
        location: node,
        messageText,
        fixes: []
      })
    }
  })
})
