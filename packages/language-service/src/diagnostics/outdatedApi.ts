import { pipe } from "effect/Function"
import type * as ts from "typescript"
import { codegens } from "../codegens.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

// if not known yet
interface Unknown {
  readonly _tag: "Unknown"
}
const asUnknown: Unknown = {
  _tag: "Unknown"
}

// is unchanged between v3 and v4
interface Unchanged {
  readonly _tag: "Unchanged"
}
const asUnchanged: Unchanged = {
  _tag: "Unchanged"
}

// is renamed between v3 and v4
interface Renamed {
  readonly _tag: "Renamed"
  readonly newName: string
}
const asRenamed = (newName: string): Renamed => ({
  _tag: "Renamed",
  newName
})

interface Removed {
  readonly _tag: "Removed"
  readonly alternativePattern: string
}
const asRemoved = (alternativePattern: string): Removed => ({
  _tag: "Removed",
  alternativePattern
})

export type Migration = Unknown | Unchanged | Renamed | Removed

export type ModuleMigrationDb = Record<string, Migration>

export const effectModuleMigrationDb: ModuleMigrationDb = {
  "succeed": asUnchanged
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
      // skip unknown migrations
      if (migration._tag === "Unknown") return
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
        Nano.map((result) => ({
          result,
          migration
        }))
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
        yield* pipe(
          checkEffectMigration,
          Nano.map((effectModule) => {
            report({
              location: node,
              messageText: "Effect module is outdated",
              fixes: []
            })
          }),
          Nano.ignore
        )
      }
    }
  })
})
