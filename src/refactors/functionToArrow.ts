import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const functionToArrow = createRefactor({
  name: "effect/functionToArrow",
  description: "Convert to arrow",
  apply: (ts) => (sourceFile, textRange) =>
    pipe(
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter(ts.isFunctionDeclaration)
      ),
      ReadonlyArray.appendAll(
        pipe(
          AST.getNodesContainingRange(ts)(sourceFile, textRange),
          ReadonlyArray.filter(ts.isMethodDeclaration)
        )
      ),
      ReadonlyArray.filter((node) => !!node.body),
      ReadonlyArray.filter((node) => !!node.name && AST.isNodeInRange(textRange)(node.name)),
      ReadonlyArray.head,
      Option.map(
        (node) => ({
          kind: "refactor.rewrite.effect.functionToArrow",
          description: "Convert to arrow",
          apply: (changeTracker) => {
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
                    ts.factory.createVariableDeclaration(
                      node.name!,
                      undefined,
                      undefined,
                      arrowFunction
                    )
                  ],
                  ts.NodeFlags.Const
                )
              )
            }
            changeTracker.replaceNode(sourceFile, node, newDeclaration)
          }
        })
      )
    )
})
