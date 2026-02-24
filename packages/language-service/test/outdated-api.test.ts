import * as Arr from "effect/Array"
import * as Ord from "effect/Order"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { getExamplesDirForVersion, getHarnessDirForVersion } from "./utils/harness.js"
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

describe("Readable completions", () => {
  it("should test the readable completions", () => {
    const v3ApiType = getPackageApiType("v3", "effect/Effect")
    const v4ApiType = getPackageApiType("v4", "effect/Effect")
    expect(v4ApiType.properties).toEqual(v3ApiType.properties)
  })
})
