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
  description: "Prevents overriding constructors in Schema classes which breaks decoding behavior",
  severity: "error",
  apply: Nano.fn("overriddenSchemaConstructor.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    function isAllowedConstructor(node: ts.ConstructorDeclaration): boolean {
      if (node.body && node.body.statements.length === 1) {
        const expressionStatement = node.body.statements[0]
        if (ts.isExpressionStatement(expressionStatement)) {
          const maybeCallSuper = expressionStatement.expression
          if (ts.isCallExpression(maybeCallSuper)) {
            if (maybeCallSuper.expression.kind === ts.SyntaxKind.SuperKeyword) {
              const expectedNames = node.parameters.map((_) => _.name).filter(ts.isIdentifier).map((_) => ts.idText(_))
              if (expectedNames.length === 2 && expectedNames.length === node.parameters.length) {
                const givenNames = maybeCallSuper.arguments.filter(ts.isIdentifier).map((_) => ts.idText(_))
                if (
                  givenNames.length === expectedNames.length &&
                  givenNames.every((name, index) => name === expectedNames[index])
                ) {
                  return true
                }
              }
            }
          }
        }
      }
      return false
    }

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
              // is a valid one?
              if (isAllowedConstructor(member)) {
                continue
              }
              // fix to rewrite as a static 'new' method
              const fixAsStaticNew = {
                fixName: "overriddenSchemaConstructor_static",
                description: "Rewrite using the static 'new' pattern",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  const visitor: ts.Visitor = (node) => {
                    if (
                      ts.isExpressionStatement(node) &&
                      ts.isCallExpression(node.expression) && ts.isToken(node.expression.expression) &&
                      node.expression.expression.kind === ts.SyntaxKind.SuperKeyword
                    ) {
                      const constructThis = ts.factory.createNewExpression(
                        ts.factory.createIdentifier("this"),
                        undefined,
                        node.expression.arguments
                      )
                      return ts.factory.createVariableStatement(
                        undefined,
                        ts.factory.createVariableDeclarationList(
                          [ts.factory.createVariableDeclaration(
                            "_this",
                            undefined,
                            undefined,
                            constructThis
                          )],
                          ts.NodeFlags.Const
                        )
                      )
                    }
                    if (ts.isToken(node) && node.kind === ts.SyntaxKind.ThisKeyword) {
                      return ts.factory.createIdentifier("_this")
                    }
                    return ts.visitEachChild(node, visitor, ts.nullTransformationContext)
                  }
                  const newBody = visitor(member.body!)! as ts.Block
                  const bodyWithReturn = ts.factory.updateBlock(
                    newBody,
                    newBody.statements.concat([
                      ts.factory.createReturnStatement(ts.factory.createIdentifier("_this"))
                    ])
                  )

                  const newMethod = ts.factory.createMethodDeclaration(
                    ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Public | ts.ModifierFlags.Static),
                    undefined,
                    "new",
                    undefined,
                    member.typeParameters,
                    member.parameters,
                    member.type,
                    bodyWithReturn
                  )

                  changeTracker.replaceNode(sourceFile, member, newMethod)
                })
              }

              // Report diagnostic at the constructor location
              report({
                location: member,
                messageText:
                  "Classes extending Schema must not override the constructor; this is because it silently breaks the schema decoding behaviour. If that's needed, we recommend instead to use a static 'new' method that constructs the instance.",
                fixes: (member.body ? [fixAsStaticNew] : []).concat([{
                  fixName: "overriddenSchemaConstructor_fix",
                  description: "Remove the constructor override",
                  apply: Nano.gen(function*() {
                    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                    changeTracker.delete(sourceFile, member)
                  })
                }])
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
