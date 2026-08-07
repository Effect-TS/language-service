import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const toggleTypeAnnotation = LSP.createRefactor({
  name: "toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: Nano.fn("toggleTypeAnnotation.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) => ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) => !!node.initializer),
      Array.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.toggleTypeAnnotation",
      description: "Toggle type annotation",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          if (node.type) {
            changeTracker.deleteRange(sourceFile, { pos: node.name.end, end: node.type.end })
            return
          }

          const initializer = node.initializer!
          const initializerType = typeChecker.getTypeAtLocation(initializer)
          const enclosingNode = ts.findAncestor(node, (_) => tsUtils.isDeclarationKind(_.kind)) || sourceFile
          const initializerTypeNode = Option.fromNullishOr(typeCheckerUtils.typeToSimplifiedTypeNode(
            initializerType,
            enclosingNode,
            ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors
          )).pipe(
            Option.getOrUndefined
          )
          if (initializerTypeNode) {
            // Effect beta.104 exposes Option through its declaration path; emit the public package path.
            const transformed = ts.transform(initializerTypeNode, [(context) => {
              const visit = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (
                  ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
                  ts.isStringLiteral(node.argument.literal) &&
                  node.argument.literal.text === "node_modules/effect/dist/Option"
                ) {
                  return ts.factory.updateImportTypeNode(
                    node,
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(
                      "effect/Option"
                    )),
                    node.attributes,
                    node.qualifier,
                    node.typeArguments,
                    node.isTypeOf
                  )
                }
                return ts.visitEachChild(node, visit, context)
              }
              return (node) => ts.visitNode(node, visit) as ts.TypeNode
            }])
            changeTracker.insertNodeAt(
              sourceFile,
              node.name.end,
              transformed.transformed[0] as ts.TypeNode,
              {
                prefix: ": "
              }
            )
            transformed.dispose()
          }
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
