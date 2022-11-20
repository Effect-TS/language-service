import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/functionToArrow",
  description: "Convert to arrow",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        pipe(AST.getNodesContainingRange(ts)(sourceFile, textRange), Ch.filter(ts.isFunctionDeclaration)),
        Ch.concat(pipe(AST.getNodesContainingRange(ts)(sourceFile, textRange), Ch.filter(ts.isMethodDeclaration))),
        Ch.filter((node) => !!node.body),
        Ch.filter((node) => !!node.name && AST.isNodeInRange(textRange)(node.name)),
        Ch.head,
        O.map(
          (node) => ({
            description: "Convert to arrow",
            apply: T.gen(function*($) {
              const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))

              const body = node.body!
              let newBody: ts.ConciseBody = ts.factory.createBlock(body.statements)
              if (body.statements.length === 1) {
                const statement = body.statements[0]
                if (statement && ts.isReturnStatement(statement) && statement.expression) {
                  newBody = statement.expression!
                }
              }

              let arrowFlags = ts.getCombinedModifierFlags(node)
              arrowFlags &= ~ts.ModifierFlags.Export
              arrowFlags &= ~ts.ModifierFlags.Default
              const arrowModifiers = ts.factory.createModifiersFromModifierFlags(arrowFlags)

              const arrowFunction = ts.factory.createArrowFunction(
                arrowModifiers,
                node.typeParameters,
                node.parameters,
                undefined,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                newBody
              )

              let constFlags = ts.getCombinedModifierFlags(node)
              constFlags &= ~arrowFlags
              const constModifiers = ts.factory.createModifiersFromModifierFlags(constFlags)

              let newDeclaration: ts.Node = node
              if (ts.isMethodDeclaration(node)) {
                newDeclaration = ts.factory.createPropertyDeclaration(
                  constModifiers,
                  node.name!,
                  undefined,
                  undefined,
                  arrowFunction
                )
              } else if (ts.isFunctionDeclaration(node)) {
                newDeclaration = ts.factory.createVariableStatement(
                  constModifiers,
                  ts.factory.createVariableDeclarationList(
                    [
                      ts.factory.createVariableDeclaration(node.name!, undefined, undefined, arrowFunction)
                    ],
                    ts.NodeFlags.Const
                  )
                )
              }
              changeTracker.replaceNode(sourceFile, node, newDeclaration)
            })
          })
        )
      )
    })
})
