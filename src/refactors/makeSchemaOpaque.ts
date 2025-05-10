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
        const types = yield* TypeParser.effectSchemaType(type, initializer)

        return { identifier, variableStatement, variableDeclarationList, types }
      }
    )

    const maybeNode = yield* pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.map(findSchema),
      Nano.firstSuccessOf,
      Nano.option
    )
    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const { identifier, types, variableDeclarationList, variableStatement } = maybeNode.value

    return {
      kind: "refactor.rewrite.effect.makeSchemaOpaque",
      description: `Make Schema opaque`,
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const effectSchemaName = Option.match(
            yield* Nano.option(
              AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
                sourceFile,
                "effect",
                "Schema"
              )
            ),
            {
              onNone: () => "Schema",
              onSome: (_) => _.text
            }
          )
          const newIdentifier = ts.factory.createIdentifier(identifier.text + "_")

          // opaque type
          const opaqueInferred = ts.factory.createExpressionWithTypeArguments(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(effectSchemaName),
                ts.factory.createIdentifier("Schema")
              ),
              ts.factory.createIdentifier("Type")
            ),
            [ts.factory.createTypeQueryNode(
              ts.factory.createIdentifier(newIdentifier.text)
            )]
          )
          const opaqueType = types.A.isUnion() ?
            ts.factory.createTypeAliasDeclaration(
              variableStatement.modifiers,
              identifier.text,
              [],
              opaqueInferred
            ) :
            ts.factory.createInterfaceDeclaration(
              variableStatement.modifiers,
              identifier.text,
              undefined,
              [ts.factory.createHeritageClause(
                ts.SyntaxKind.ExtendsKeyword,
                [opaqueInferred]
              )],
              []
            )
          // encoded type
          const encodedInferred = ts.factory.createExpressionWithTypeArguments(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(effectSchemaName),
                ts.factory.createIdentifier("Schema")
              ),
              ts.factory.createIdentifier("Encoded")
            ),
            [ts.factory.createTypeQueryNode(
              ts.factory.createIdentifier(newIdentifier.text)
            )]
          )
          const encodedType = types.I.isUnion() ?
            ts.factory.createTypeAliasDeclaration(
              variableStatement.modifiers,
              identifier.text + "Encoded",
              [],
              encodedInferred
            ) :
            ts.factory.createInterfaceDeclaration(
              variableStatement.modifiers,
              identifier.text + "Encoded",
              undefined,
              [ts.factory.createHeritageClause(
                ts.SyntaxKind.ExtendsKeyword,
                [encodedInferred]
              )],
              []
            )

          // context
          const contextInferred = ts.factory.createExpressionWithTypeArguments(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(effectSchemaName),
                ts.factory.createIdentifier("Schema")
              ),
              ts.factory.createIdentifier("Context")
            ),
            [ts.factory.createTypeQueryNode(
              ts.factory.createIdentifier(newIdentifier.text)
            )]
          )
          const contextType = ts.factory.createTypeAliasDeclaration(
            variableStatement.modifiers,
            identifier.text + "Context",
            [],
            contextInferred
          )

          changeTracker.replaceNode(
            sourceFile,
            identifier,
            newIdentifier
          )
          changeTracker.insertNodeAfter(sourceFile, variableStatement, opaqueType)
          changeTracker.insertNodeAfter(sourceFile, variableStatement, encodedType)
          changeTracker.insertNodeAfter(sourceFile, variableStatement, contextType)

          // insert new declaration
          const newSchemaType = ts.factory.createTypeReferenceNode(
            ts.factory.createQualifiedName(
              ts.factory.createIdentifier(effectSchemaName),
              ts.factory.createIdentifier("Schema")
            ),
            [
              ts.factory.createTypeReferenceNode(opaqueType.name),
              ts.factory.createTypeReferenceNode(encodedType.name),
              ts.factory.createTypeReferenceNode(contextType.name)
            ]
          )
          const newConstDeclaration = ts.factory.createVariableStatement(
            variableStatement.modifiers,
            ts.factory.createVariableDeclarationList(
              [ts.factory.createVariableDeclaration(
                identifier.text,
                undefined,
                newSchemaType,
                ts.factory.createIdentifier(newIdentifier.text)
              )],
              variableDeclarationList.flags
            )
          )

          changeTracker.insertNodeAfter(sourceFile, variableStatement, newConstDeclaration)
          changeTracker.insertText(sourceFile, variableStatement.end, "\n")
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    }
  })
})
