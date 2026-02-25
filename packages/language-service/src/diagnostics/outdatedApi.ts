import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as MigrationDb from "./outdatedApi.db.js"

export const outdatedApi = LSP.createDiagnostic({
  name: "outdatedApi",
  code: 48,
  description: "Detects usage of APIs that have been removed or renamed in Effect v4",
  severity: "warning",
  apply: Nano.fn("outdatedApi.apply")(function*(sourceFile, report) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    if (typeParser.supportedEffect() === "v3") return
    let hasReported = false

    function reportMigration(
      propertyAccess: ts.PropertyAccessExpression,
      propertyName: string,
      _migration: MigrationDb.Migration
    ) {
      hasReported = true
      report({
        location: propertyAccess.name,
        messageText: `${propertyName} is an Effect v3 API, but the project is using Effect v4.`,
        fixes: []
      })
    }

    const checkPropertyAccessMigration = <A, E, R>(
      propertyAccess: ts.Node,
      checkRightNode: (node: ts.Node) => Nano.Nano<A, E, R>,
      migrationDb: MigrationDb.ModuleMigrationDb
    ) => {
      if (!ts.isPropertyAccessExpression(propertyAccess)) return
      const identifier = propertyAccess.name
      if (!ts.isIdentifier(identifier)) return
      const identifierName = ts.idText(identifier)
      const migration = migrationDb[identifierName]
      if (!migration) return
      // skip unchanged migrations
      if (migration._tag === "Unchanged") return
      // should not exist in target type
      const targetType = typeCheckerUtils.getTypeAtLocation(propertyAccess.expression)
      if (!targetType) return
      // only if the property does not exists in the target type
      const targetPropertySymbol = typeChecker.getPropertyOfType(targetType, identifierName)
      if (targetPropertySymbol) return
      return pipe(
        checkRightNode(propertyAccess.expression),
        Nano.map(() => reportMigration(propertyAccess, identifierName, migration)),
        Nano.ignore
      )
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const checkEffectMigration = checkPropertyAccessMigration(
        node,
        typeParser.importedEffectModule,
        MigrationDb.effectModuleMigrationDb
      )
      if (checkEffectMigration) {
        yield* Nano.ignore(checkEffectMigration)
      }
    }

    if (hasReported) {
      report({
        location: { pos: 0, end: 0 },
        messageText:
          "This project targets Effect v4, but is using Effect v3 APIs. To find the correct API to use, clone and consult the github.com/effect-ts/effect-smol repository for the corresponding v4 replacement.",
        fixes: []
      })
    }
  })
})
