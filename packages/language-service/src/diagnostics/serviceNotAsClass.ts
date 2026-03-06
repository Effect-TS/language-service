import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const serviceNotAsClass = LSP.createDiagnostic({
  name: "serviceNotAsClass",
  code: 51,
  description: "Warns when ServiceMap.Service is used as a variable instead of a class declaration",
  severity: "off",
  apply: Nano.fn("serviceNotAsClass.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    if (typeParser.supportedEffect() === "v3") return

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isVariableDeclaration(node)) continue
      if (!node.initializer || !ts.isCallExpression(node.initializer)) continue

      const callExpr = node.initializer
      if (!callExpr.typeArguments || callExpr.typeArguments.length === 0) continue
      const typeArgs = callExpr.typeArguments

      // Check parent VariableDeclarationList uses const
      const declList = node.parent
      if (!ts.isVariableDeclarationList(declList)) continue
      if (!(declList.flags & ts.NodeFlags.Const)) continue

      const isServiceMapService = yield* pipe(
        typeParser.isNodeReferenceToServiceMapModuleApi("Service")(callExpr.expression),
        Nano.orUndefined
      )
      if (!isServiceMapService) continue

      const variableName = ts.isIdentifier(node.name)
        ? ts.idText(node.name)
        : sourceFile.text.substring(ts.getTokenPosOfNode(node.name, sourceFile), node.name.end)
      const variableStatement = declList.parent

      const argsText = callExpr.arguments.length > 0
        ? callExpr.arguments.map((a) => sourceFile.text.substring(ts.getTokenPosOfNode(a, sourceFile), a.end))
          .join(", ")
        : ""

      const shapeText = typeArgs.length > 0
        ? typeArgs.map((t) => sourceFile.text.substring(ts.getTokenPosOfNode(t, sourceFile), t.end)).join(", ")
        : "Shape"

      report({
        location: callExpr,
        messageText:
          `ServiceMap.Service should be used in a class declaration instead of as a variable. Use: class ${variableName} extends ServiceMap.Service<${variableName}, ${shapeText}>()("${
            argsText.replace(/['"]/g, "")
          }") {}`,
        fixes: [{
          fixName: "serviceNotAsClass",
          description: `Convert to class declaration`,
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            const targetNode = ts.isVariableStatement(variableStatement) ? variableStatement : declList

            // Build inner call: ServiceMap.Service<Self, ...OriginalTypeArgs>()
            const innerCall = ts.factory.createCallExpression(
              callExpr.expression,
              [ts.factory.createTypeReferenceNode(variableName), ...typeArgs],
              []
            )

            // Build outer call: ServiceMap.Service<FirstTypeArg, {}>()(args...)
            const outerCall = ts.factory.createCallExpression(
              innerCall,
              undefined,
              [...callExpr.arguments]
            )

            // Build heritage clause: extends ServiceMap.Service<FirstTypeArg, {}>()(args...)
            const heritageClause = ts.factory.createHeritageClause(
              ts.SyntaxKind.ExtendsKeyword,
              [ts.factory.createExpressionWithTypeArguments(outerCall, undefined)]
            )

            // Build class declaration — reuse existing modifiers from the variable statement
            const modifiers = ts.isVariableStatement(variableStatement)
              ? variableStatement.modifiers
              : undefined

            const classDeclaration = ts.factory.createClassDeclaration(
              modifiers,
              ts.isIdentifier(node.name) ? node.name : ts.factory.createIdentifier(variableName),
              undefined,
              [heritageClause],
              []
            )

            changeTracker.replaceNode(sourceFile, targetNode, classDeclaration)
          })
        }]
      })
    }
  })
})
