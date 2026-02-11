import { pipe } from "effect"
import type ts from "typescript"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const deterministicKeys = LSP.createDiagnostic({
  name: "deterministicKeys",
  code: 25,
  description: "Enforces deterministic naming for service/tag/error identifiers based on class names",
  severity: "off",
  apply: Nano.fn("deterministicKeys.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeScriptUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    const parseExtendsCustom = Nano.cachedBy(
      Nano.fn("parseExtendsCustom")(function*(classDeclaration: ts.ClassDeclaration) {
        if (!options.extendedKeyDetection) {
          return yield* TypeParser.typeParserIssue("Extended key detection is disabled", undefined, classDeclaration)
        }
        if (!classDeclaration.name) {
          return yield* TypeParser.typeParserIssue("Class has no name", undefined, classDeclaration)
        }
        if (!ts.isIdentifier(classDeclaration.name)) {
          return yield* TypeParser.typeParserIssue("Class name is not an identifier", undefined, classDeclaration)
        }
        const heritageClauses = classDeclaration.heritageClauses
        if (!heritageClauses) {
          return yield* TypeParser.typeParserIssue("Class has no heritage clauses", undefined, classDeclaration)
        }

        const nodeToVisit: Array<ts.Node> = [...classDeclaration.heritageClauses]
        const appendNodeToVisit = (node: ts.Node) => {
          nodeToVisit.push(node)
          return undefined
        }

        while (nodeToVisit.length > 0) {
          const node = nodeToVisit.shift()!
          if (ts.isCallExpression(node)) {
            for (let i = 0; i < node.arguments.length; i++) {
              const arg = node.arguments[i]
              if (!ts.isStringLiteral(arg)) continue
              const resolvedSignature = typeChecker.getResolvedSignature(node)
              if (resolvedSignature) {
                const parameter = resolvedSignature.parameters[i]
                if (!parameter) continue
                if (parameter.declarations) {
                  for (const declaration of parameter.declarations) {
                    const parameterSourceFile = typeScriptUtils.getSourceFileOfNode(declaration)!
                    const paramText = parameterSourceFile.text.substring(declaration.pos, declaration.end)
                    if (paramText.toLowerCase().includes("@effect-identifier")) {
                      return { className: classDeclaration.name, keyStringLiteral: arg, target: "custom" as const }
                    }
                  }
                }
              }
            }
          }
          ts.forEachChild(node, appendNodeToVisit)
        }

        return yield* TypeParser.typeParserIssue(
          "Class does not extend any custom pattern",
          undefined,
          classDeclaration
        )
      }),
      "deterministicKeys.parseExtendsCustom",
      (classDeclaration) => classDeclaration
    )

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a class declaration that extends Effect.Service, Context.Tag, or Effect.Tag
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        // Try to parse as one of the supported tag/service types
        // @effect-diagnostics-next-line unnecessaryPipeChain:off
        const result = yield* pipe(
          pipe(
            typeParser.extendsEffectService(node),
            Nano.orElse(() => typeParser.extendsContextTag(node)),
            Nano.orElse(() => typeParser.extendsEffectTag(node)),
            Nano.orElse(() => typeParser.extendsServiceMapService(node)),
            Nano.map(({ className, keyStringLiteral }) => ({ keyStringLiteral, className, target: "service" as const }))
          ),
          Nano.orElse(() =>
            pipe(
              typeParser.extendsDataTaggedError(node),
              Nano.orElse(() => typeParser.extendsSchemaTaggedError(node)),
              Nano.map(({ className, keyStringLiteral }) => ({ keyStringLiteral, className, target: "error" as const }))
            )
          ),
          Nano.orElse(() => parseExtendsCustom(node)),
          Nano.orElse(() => Nano.void_)
        )

        if (result && result.keyStringLiteral) {
          const { className, keyStringLiteral, target } = result

          // Get the class name text
          const classNameText = ts.idText(className)

          // build the expected identifier
          const expectedKey = yield* KeyBuilder.createString(sourceFile, classNameText, target)
          if (!expectedKey) continue

          // Get the actual identifier from the keyStringLiteral
          const actualIdentifier = keyStringLiteral.text

          // Report diagnostic if they don't match
          if (actualIdentifier !== expectedKey) {
            report({
              location: keyStringLiteral,
              messageText: `Key should be '${expectedKey}'`,
              fixes: [{
                fixName: "deterministicKeys_fix",
                description: `Replace '${actualIdentifier}' with '${expectedKey}'`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Create a new string literal with the correct identifier
                  const newStringLiteral = ts.factory.createStringLiteral(expectedKey)

                  // Replace the incorrect string literal with the correct one
                  changeTracker.replaceNode(sourceFile, keyStringLiteral, newStringLiteral)
                })
              }]
            })
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
