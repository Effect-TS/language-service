import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import { _createOpaqueTypes, _findSchemaVariableDeclaration } from "./makeSchemaOpaque.js"

export const makeSchemaOpaqueWithNs = LSP.createRefactor({
  name: "makeSchemaOpaqueWithNs",
  description: "Make Schema opaque with namespace",
  apply: Nano.fn("makeSchemaOpaqueWithNs.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const supportedEffect = typeParser.supportedEffect()

    const maybeNode = yield* _findSchemaVariableDeclaration(sourceFile, textRange)
    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const { identifier, types, variableDeclarationList, variableStatement } = maybeNode.value

    return {
      kind: "refactor.rewrite.effect.makeSchemaOpaqueWithNs",
      description: `Make Schema opaque with namespace`,
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const effectSchemaName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Schema"
          ) || "Schema"

          const newIdentifier = ts.factory.createIdentifier(ts.idText(identifier) + "_")
          const { contextEncodeType, contextType, encodedType, opaqueType } = yield* _createOpaqueTypes(
            effectSchemaName,
            ts.idText(newIdentifier),
            types.A,
            ts.idText(identifier),
            types.I,
            "Encoded",
            supportedEffect === "v4" ? "DecodingServices" : "Context",
            supportedEffect === "v4",
            supportedEffect === "v4" ? "EncodingServices" : "Context"
          )

          const namespace = ts.factory.createModuleDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            ts.factory.createIdentifier(ts.idText(identifier)),
            ts.factory.createModuleBlock([
              encodedType,
              contextType
            ].concat(supportedEffect === "v4" ? [contextEncodeType] : [])),
            ts.NodeFlags.Namespace
          )

          changeTracker.replaceNode(
            sourceFile,
            identifier,
            newIdentifier
          )
          changeTracker.insertNodeAfter(sourceFile, variableStatement, opaqueType)
          changeTracker.insertNodeAfter(sourceFile, variableStatement, namespace)

          const namespaceName = ts.isStringLiteral(namespace.name) ? namespace.name.text : ts.idText(namespace.name)

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
                  ts.factory.createIdentifier(
                    namespaceName
                  ),
                  ts.idText(encodedType.name)
                )
              ),
              ts.factory.createTypeReferenceNode(ts.factory.createQualifiedName(
                ts.factory.createIdentifier(namespaceName),
                ts.idText(contextType.name)
              ))
            ]
          )
          const newConstDeclaration = ts.factory.createVariableStatement(
            variableStatement.modifiers,
            ts.factory.createVariableDeclarationList(
              [ts.factory.createVariableDeclaration(
                ts.idText(identifier),
                undefined,
                newSchemaType,
                ts.factory.createIdentifier(ts.idText(newIdentifier))
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
