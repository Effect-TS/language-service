import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const makeSchemaOpaque = LSP.createRefactor({
  name: "effect/makeSchemaOpaque",
  description: "Make Schema opaque",
  apply: Nano.fn("makeSchemaOpaque.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const findSchema = Nano.fn("makeSchemaOpaque.apply.findSchema")(
      function*(node: ts.Node) {
        if (!ts.isVariableDeclaration(node)) {
          return yield* Nano.fail("parent should be variable declaration")
        }
        const identifier = node.name
        if (!ts.isIdentifier(identifier)) return yield* Nano.fail("name should be an identifier")
        const initializer = node.initializer
        if (!initializer) return yield* Nano.fail("should have an initializer")

        const variableDeclarationList = node.parent
        if (!variableDeclarationList || !ts.isVariableDeclarationList(variableDeclarationList)) {
          return yield* Nano.fail("parent is not a variable declaration list")
        }

        const variableStatement = variableDeclarationList.parent
        if (!variableStatement || !ts.isVariableStatement(variableStatement)) {
          return yield* Nano.fail("parent not variable declaration statement")
        }

        const type = typeChecker.getTypeAtLocation(initializer)
        yield* TypeParser.effectSchemaType(type, initializer)

        return { identifier, variableStatement, variableDeclarationList }
      }
    )

    const maybeNode = yield* pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.map(findSchema),
      Nano.firstSuccessOf,
      Nano.option
    )
    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const { identifier, variableDeclarationList, variableStatement } = maybeNode.value

    return {
      kind: "refactor.rewrite.effect.makeSchemaOpaque",
      description: `Make Schema opaque`,
      apply: Nano.gen(function*() {
        const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

        const newIdentifier = ts.factory.createIdentifier(identifier.text + "_")
        // change current name
        changeTracker.replaceNode(
          sourceFile,
          identifier,
          newIdentifier
        )
        // insert new declaration
        const newDeclaration = ts.factory.createVariableStatement(
          variableStatement.modifiers,
          ts.factory.createVariableDeclarationList(
            [ts.factory.createVariableDeclaration(
              identifier.text,
              undefined,
              undefined,
              identifier
            )],
            variableDeclarationList.flags
          )
        )
        changeTracker.insertNodeAfter(sourceFile, variableStatement, newDeclaration)
      })
    }
  })
})
