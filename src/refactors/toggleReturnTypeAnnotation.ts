import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const toggleReturnTypeAnnotation = LSP.createRefactor({
  name: "toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: Nano.fn("toggleReturnTypeAnnotation.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    function addReturnTypeAnnotation(
      sourceFile: ts.SourceFile,
      changeTracker: ts.textChanges.ChangeTracker,
      declaration:
        | ts.FunctionDeclaration
        | ts.FunctionExpression
        | ts.ArrowFunction
        | ts.MethodDeclaration,
      typeNode: ts.TypeNode
    ) {
      const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
      const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
      const endNode = needParens ? declaration.parameters[0] : closeParen
      if (endNode) {
        if (needParens) {
          changeTracker.insertNodeBefore(
            sourceFile,
            endNode,
            ts.factory.createToken(ts.SyntaxKind.OpenParenToken)
          )
          changeTracker.insertNodeAfter(
            sourceFile,
            endNode,
            ts.factory.createToken(ts.SyntaxKind.CloseParenToken)
          )
        }
        changeTracker.insertNodeAt(sourceFile, endNode.end, typeNode, { prefix: ": " })
      }
    }

    function removeReturnTypeAnnotation(
      sourceFile: ts.SourceFile,
      changeTracker: ts.textChanges.ChangeTracker,
      declaration:
        | ts.FunctionDeclaration
        | ts.FunctionExpression
        | ts.ArrowFunction
        | ts.MethodDeclaration
    ) {
      const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
      const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
      const endNode = needParens ? declaration.parameters[0] : closeParen
      if (endNode && declaration.type) {
        changeTracker.deleteRange(sourceFile, { pos: endNode.end, end: declaration.type.end })
      }
    }

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.filter((node) =>
        ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
      ),
      ReadonlyArray.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    if (node.type) {
      return ({
        kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
        description: "Toggle return type annotation",
        apply: pipe(
          Nano.service(TypeScriptApi.ChangeTracker),
          Nano.map((changeTracker) => removeReturnTypeAnnotation(sourceFile, changeTracker, node))
        )
      })
    }

    const returnType = typeCheckerUtils.getInferredReturnType(node)
    if (!returnType) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const returnTypeNode = typeCheckerUtils.typeToSimplifiedTypeNode(
      returnType,
      node,
      ts.NodeBuilderFlags.NoTruncation
    )

    if (!returnTypeNode) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    return ({
      kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
      description: "Toggle return type annotation",
      apply: pipe(
        Nano.service(TypeScriptApi.ChangeTracker),
        Nano.map((changeTracker) => addReturnTypeAnnotation(sourceFile, changeTracker, node, returnTypeNode))
      )
    })
  })
})
