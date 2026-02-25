import * as Arr from "effect/Array"
import * as Ord from "effect/Order"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { effectModuleMigrationDb } from "../src/diagnostics/outdatedApi.js"
import { getExamplesDirForVersion, getHarnessDirForVersion, getHarnessVersion } from "./utils/harness.js"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

function getPackageApiType(version: "v3" | "v4", moduleName: string) {
  const fileName = "index.ts"
  const { program, sourceFile } = createServicesWithMockedVFS(
    getHarnessDirForVersion(version),
    getExamplesDirForVersion(version),
    fileName,
    `import * as PackageApi from "${moduleName}"
    export const api = PackageApi
    `
  )
  const typeChecker = program.getTypeChecker()
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) throw new Error("Module symbol not found")
  const apiSymbol = typeChecker.tryGetMemberInModuleExports("api", moduleSymbol)
  if (!apiSymbol) throw new Error("API symbol not found")
  const apiType = typeChecker.getTypeOfSymbol(apiSymbol)
  if (!apiType) throw new Error("API type not found")
  return { apiType, program, properties: getPropertiesOfType(program, apiType) }
}

function getPropertiesOfType(program: ts.Program, type: ts.Type) {
  const typeChecker = program.getTypeChecker()
  const properties = typeChecker.getPropertiesOfType(type)
  return Arr.sort(Arr.map(properties, (_) => ts.unescapeLeadingUnderscores(_.escapedName)), Ord.String)
}

describe.skipIf(getHarnessVersion() !== "v4")("Outdated API", () => {
  it("effect/Effect APIs", () => {
    const v3ApiType = getPackageApiType("v3", "effect/Effect")
    const v4ApiType = getPackageApiType("v4", "effect/Effect")

    // things marked as deleted, should not be in the v4 api
    for (
      const [property, migration] of Object.entries(effectModuleMigrationDb)
    ) {
      if (
        migration._tag === "Removed"
      ) {
        expect(
          v4ApiType.properties,
          `Method ${property} is marked as deleted or unknown in effectModuleMigrationDb, but is present in the v4 api`
        ).not.toContain(property)
      }
    }

    // new v4 api should exists in the v4 api
    for (
      const [property, migration] of Object.entries(effectModuleMigrationDb)
    ) {
      if (
        migration._tag === "RenamedSameBehaviour" || migration._tag === "RenamedAndNeedsOptions"
      ) {
        expect(
          v4ApiType.properties,
          `Method ${property} is marked as renamed to ${migration.newName} in effectModuleMigrationDb, but is not present in the v4 api`
        ).toContain(migration.newName)
      }
      if (migration._tag === "Unchanged") {
        expect(
          v4ApiType.properties,
          `Method ${property} is marked as unchanged in effectModuleMigrationDb, but is not present in the v4 api`
        ).toContain(property)
      }
    }

    // every v3 api should be handled
    for (const property of v3ApiType.properties) {
      expect(
        Object.keys(effectModuleMigrationDb),
        `Migration for ${property} is not handled in effectModuleMigrationDb, please add it to the effectModuleMigrationDb`
      ).toContain(property)
    }
  })
})
