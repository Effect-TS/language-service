import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const overriddenSchemaConstructor = LSP.createDiagnostic({
  name: "overriddenSchemaConstructor",
  code: 30,
  severity: "error",
  apply: Nano.fn("overriddenSchemaConstructor.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a class declaration with heritage clauses
      if (ts.isClassDeclaration(node) && node.heritageClauses) {
        // Check if any heritage clause extends a Schema type
        let extendsSchema = false

        for (const heritageClause of node.heritageClauses) {
          if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const type of heritageClause.types) {
              const typeAtLocation = typeChecker.getTypeAtLocation(type.expression)
              // Check if this type is a valid Schema type
              const isSchema = yield* pipe(
                typeParser.effectSchemaType(typeAtLocation, type.expression),
                Nano.map(() => true),
                Nano.orElse(() => Nano.succeed(false))
              )

              if (isSchema) {
                extendsSchema = true
                break
              }
            }
          }
          if (extendsSchema) break
        }

        // If the class extends a Schema, check for constructor overrides
        if (extendsSchema) {
          const members = node.members
          for (const member of members) {
            if (ts.isConstructorDeclaration(member)) {
              // Report diagnostic at the constructor location
              report({
                location: member,
                messageText: "Classes extending Schema must not override the constructor",
                fixes: [{
                  fixName: "overriddenSchemaConstructor_fix",
                  description: "Remove the constructor override",
                  apply: Nano.gen(function*() {
                    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                    changeTracker.delete(sourceFile, member)
                  })
                }]
              })
              break
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
