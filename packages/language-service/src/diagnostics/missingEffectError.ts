import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Order from "effect/Order"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const missingEffectError = LSP.createDiagnostic({
  name: "missingEffectError",
  code: 1,
  description: "Reports missing error types in Effect error channel",
  severity: "error",
  apply: Nano.fn("missingEffectError.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const effectModuleIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    const createDieMessage = (message: string) =>
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(effectModuleIdentifier),
          "dieMessage"
        ),
        undefined,
        [ts.factory.createStringLiteral(message)]
      )

    const checkForMissingErrorTypes = (
      node: ts.Node,
      expectedType: ts.Type,
      valueNode: ts.Node,
      realType: ts.Type
    ) =>
      pipe(
        Nano.all(
          typeParser.effectType(expectedType, node),
          typeParser.effectType(realType, valueNode)
        ),
        Nano.map(([expectedEffect, realEffect]) =>
          pipe(
            typeCheckerUtils.getMissingTypeEntriesInTargetType(
              realEffect.E,
              expectedEffect.E
            ),
            (missingErrorTypes) => ({ missingErrorTypes, expectedErrorType: expectedEffect.E })
          )
        )
      )

    const sortTypes = ReadonlyArray.sort(typeCheckerUtils.deterministicTypeOrder)

    const entries = LSP.getEffectLspPatchSourceFileMetadata(sourceFile)?.relationErrors ||
      typeCheckerUtils.expectedAndRealType(sourceFile)
    for (const [node, expectedType, valueNode, realType] of entries) {
      // if the types are different, check for missing error types
      if (expectedType !== realType) {
        yield* pipe(
          checkForMissingErrorTypes(
            node,
            expectedType,
            valueNode,
            realType
          ),
          Nano.map((result) => {
            if (result.missingErrorTypes.length === 0) return
            const fixes: Array<LSP.ApplicableDiagnosticDefinitionFix> = []

            const catchAllErrorsName = typeParser.supportedEffect() === "v3" ? "catchAll" : "catch"

            if (
              ts.isExpression(valueNode) &&
              result.expectedErrorType.flags & ts.TypeFlags.Never &&
              catchAllErrorsName
            ) {
              fixes.push({
                fixName: `missingEffectError_${catchAllErrorsName}`,
                description: `Catch all errors with Effect.${catchAllErrorsName}`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  changeTracker.insertText(
                    sourceFile,
                    ts.getTokenPosOfNode(valueNode, sourceFile),
                    effectModuleIdentifier + `.${catchAllErrorsName}(`
                  )
                  changeTracker.insertText(sourceFile, valueNode.end, ", () => ")
                  changeTracker.insertNodeAt(
                    sourceFile,
                    valueNode.end,
                    createDieMessage(`TODO: ${catchAllErrorsName} not implemented`)
                  )
                  changeTracker.insertText(sourceFile, valueNode.end, ")")
                })
              })
            }

            if (ts.isExpression(valueNode)) {
              const propertyAssignments = pipe(
                result.missingErrorTypes,
                ReadonlyArray.map((_) => typeChecker.getPropertyOfType(_, "_tag")),
                ReadonlyArray.filter((_) => !!_),
                ReadonlyArray.map((_) => typeChecker.getTypeOfSymbolAtLocation(_, valueNode)),
                ReadonlyArray.filter((_) => !!(_.flags & ts.TypeFlags.Literal)),
                ReadonlyArray.map((_) => typeChecker.typeToTypeNode(_, undefined, ts.NodeBuilderFlags.NoTruncation)),
                ReadonlyArray.filter((_) => !!_ && ts.isLiteralTypeNode(_)),
                ReadonlyArray.map((_) => _.literal),
                ReadonlyArray.filter((_) => ts.isLiteralExpression(_)),
                ReadonlyArray.map((_) => _.text),
                ReadonlyArray.sort(Order.string),
                ReadonlyArray.map((_) =>
                  ts.factory.createPropertyAssignment(
                    ts.factory.createIdentifier(_),
                    ts.factory.createArrowFunction(
                      undefined,
                      undefined,
                      [],
                      undefined,
                      undefined,
                      createDieMessage(`TODO: catchTags() not implemented for ${_}`)
                    )
                  )
                )
              )
              if (propertyAssignments.length === result.missingErrorTypes.length) {
                fixes.push({
                  fixName: "missingEffectError_tagged",
                  description: "Catch unexpected errors with Effect.catchTag",
                  apply: Nano.gen(function*() {
                    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                    changeTracker.insertText(
                      sourceFile,
                      ts.getTokenPosOfNode(valueNode, sourceFile),
                      effectModuleIdentifier + ".catchTags("
                    )
                    changeTracker.insertText(sourceFile, valueNode.end, ", ")
                    changeTracker.insertNodeAt(
                      sourceFile,
                      valueNode.end,
                      ts.factory.createObjectLiteralExpression(propertyAssignments)
                    )
                    changeTracker.insertText(sourceFile, valueNode.end, ")")
                  })
                })
              }
            }

            const typeNames = sortTypes(result.missingErrorTypes).map((_) => typeChecker.typeToString(_))
            report(
              {
                location: node,
                messageText: `Missing '${typeNames.join(" | ")}' in the expected Effect errors.`,
                fixes
              }
            )
          }),
          Nano.ignore
        )
      }
    }
  })
})
