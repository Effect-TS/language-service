import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

// is unchanged between v3 and v4
interface Unchanged {
  readonly _tag: "Unchanged"
}
const asUnchanged: Unchanged = {
  _tag: "Unchanged"
}

// is renamed between v3 and v4 and kept as is
interface RenamedSameBehaviour {
  readonly _tag: "RenamedSameBehaviour"
  readonly newName: string
}
const asRenamedSameBehaviour = (newName: string): RenamedSameBehaviour => ({
  _tag: "RenamedSameBehaviour",
  newName
})

// is renamed between v3 and v4, and needs options to be used in the v4 api to get the same behaviour of v3
interface RenamedAndNeedsOptions {
  readonly _tag: "RenamedAndNeedsOptions"
  readonly newName: string
  readonly optionsInstructions: string
}
const asRenamedAndNeedsOptions = (newName: string, optionsInstructions: string): RenamedAndNeedsOptions => ({
  _tag: "RenamedAndNeedsOptions",
  newName,
  optionsInstructions
})

interface Removed {
  readonly _tag: "Removed"
  readonly alternativePattern: string
}
const asRemoved = (alternativePattern: string): Removed => ({
  _tag: "Removed",
  alternativePattern
})

export type Migration = Unchanged | RenamedSameBehaviour | RenamedAndNeedsOptions | Removed

export type ModuleMigrationDb = Record<string, Migration>

export const effectModuleMigrationDb: ModuleMigrationDb = {
  "succeed": asUnchanged,
  "runtime": asRemoved(
    "Runtime module has been removed in Effect v4, you can use Effect.services to grab services and then run using Effect.runPromiseWith"
  ),
  "catchAll": asRenamedSameBehaviour("catch")
}

export const outdatedApi = LSP.createDiagnostic({
  name: "outdatedApi",
  code: 19,
  description: "Detects when generated code is outdated and needs to be regenerated",
  severity: "warning",
  apply: Nano.fn("outdatedEffectCodegen.apply")(function*(sourceFile, report) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    if (typeParser.supportedEffect() === "v3") return

    const checkPropertyAccessMigration = <A, E, R>(
      propertyAccess: ts.Node,
      checkRightNode: (node: ts.Node) => Nano.Nano<A, E, R>,
      migrationDb: ModuleMigrationDb
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
        Nano.map(() => {
          if (migration._tag === "RenamedSameBehaviour" || migration._tag === "RenamedAndNeedsOptions") {
            report({
              location: propertyAccess.name,
              messageText: `Effect v3's "${identifierName}" has been renamed to "${migration.newName}" in Effect v4. ${
                migration._tag === "RenamedAndNeedsOptions" ? migration.optionsInstructions : ""
              }`,
              fixes: [{
                fixName: "outdatedApi_fix",
                description: `Replace "${identifierName}" with "${migration.newName}"`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                  changeTracker.deleteRange(sourceFile, {
                    pos: ts.getTokenPosOfNode(propertyAccess.name, sourceFile),
                    end: propertyAccess.name.end
                  })
                  changeTracker.insertText(
                    sourceFile,
                    propertyAccess.name.end,
                    migration.newName
                  )
                })
              }]
            })
          } else if (migration._tag === "Removed") {
            report({
              location: propertyAccess.name,
              messageText:
                `Effect v3's "${identifierName}" has been removed in Effect v4. ${migration.alternativePattern}`,
              fixes: []
            })
          }
        })
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
        effectModuleMigrationDb
      )
      if (checkEffectMigration) {
        yield* Nano.ignore(checkEffectMigration)
      }
    }
  })
})
