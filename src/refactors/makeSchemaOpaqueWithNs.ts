import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import { _createOpaqueTypes, _findSchemaVariableDeclaration } from "./makeSchemaOpaque.js"

export const makeSchemaOpaqueWithNs = LSP.createRefactor({
  name: "effect/makeSchemaOpaqueWithNs",
  description: "Make Schema opaque with namespace",
  apply: Nano.fn("makeSchemaOpaqueWithNs.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeNode = yield* _findSchemaVariableDeclaration(sourceFile, textRange)
    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const { identifier, types, variableDeclarationList, variableStatement } = maybeNode.value

    return {
      kind: "refactor.rewrite.effect.makeSchemaOpaqueWithNs",
      description: `Make Schema opaque with namespace`,
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
          const { contextType, encodedType, opaqueType } = _createOpaqueTypes(
            effectSchemaName,
            newIdentifier.text,
            types.A,
            identifier.text,
            types.I,
            "Encoded",
            "Context"
          )

          const namespace = ts.factory.createModuleDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            ts.factory.createIdentifier(identifier.text),
            ts.factory.createModuleBlock([
              encodedType,
              contextType
            ]),
            ts.NodeFlags.Namespace
          )

          changeTracker.replaceNode(
            sourceFile,
            identifier,
            newIdentifier
          )
          changeTracker.insertNodeAfter(sourceFile, variableStatement, opaqueType)
          changeTracker.insertNodeAfter(sourceFile, variableStatement, namespace)

          // insert new declaration
          const newSchemaType = ts.factory.createTypeReferenceNode(
            ts.factory.createQualifiedName(
              ts.factory.createIdentifier(effectSchemaName),
              ts.factory.createIdentifier("Schema")
            ),
            [
              ts.factory.createTypeReferenceNode(opaqueType.name),
              ts.factory.createTypeReferenceNode(
                ts.factory.createQualifiedName(
                  ts.factory.createIdentifier(namespace.name.text),
                  encodedType.name
                )
              ),
              ts.factory.createTypeReferenceNode(ts.factory.createQualifiedName(
                ts.factory.createIdentifier(namespace.name.text),
                contextType.name
              ))
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
