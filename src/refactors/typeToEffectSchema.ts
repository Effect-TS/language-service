import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as SchemaGen from "../utils/SchemaGen.js"

export const typeToEffectSchema = LSP.createRefactor({
  name: "effect/typeToEffectSchema",
  description: "Refactor to Schema",
  apply: Nano.fn("typeToEffectSchema.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeNode = pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.filter((node) => ts.isInterfaceDeclaration(node)),
      ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      ReadonlyArray.filter((node) => (node.typeParameters || []).length === 0),
      ReadonlyArray.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.typeToEffectSchema",
      description: "Refactor to Schema",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          return yield* pipe(
            SchemaGen.processInterfaceDeclaration(sourceFile, node),
            Nano.flatMap((asEffectSchema) =>
              Nano.sync(() =>
                changeTracker.insertNodeAt(sourceFile, node.getFullStart(), asEffectSchema, {
                  prefix: "\n",
                  suffix: "\n"
                })
              )
            ),
            Nano.orElse((error) => {
              const errorComment = ts.addSyntheticLeadingComment(
                ts.factory.createIdentifier(""),
                ts.SyntaxKind.MultiLineCommentTrivia,
                " " + String(error) + " ",
                true
              )
              return Nano.sync(() =>
                changeTracker.insertNodeAt(sourceFile, node.getFullStart(), errorComment)
              )
            })
          )
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
