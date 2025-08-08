import * as AutoImport from "@effect/language-service/core/AutoImport"
import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { pipe } from "effect/Function"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

function testAutoImport(
  exportName: string,
  moduleName: string,
  settings: Partial<LanguageServicePluginOptions.LanguageServicePluginOptions>
) {
  const { program, sourceFile } = createServicesWithMockedVFS(
    "test.ts",
    ""
  )

  const resolution = ts.resolveModuleName(
    moduleName,
    sourceFile.fileName,
    program.getCompilerOptions(),
    program as any
  )
  if (!resolution.resolvedModule) throw new Error("module " + moduleName + "  not found")
  const exportFileName = resolution.resolvedModule.resolvedFileName

  const test = pipe(
    AutoImport.makeAutoImportProvider(sourceFile),
    Nano.map((_) => _.resolve(exportFileName, exportName)),
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(
      LanguageServicePluginOptions.LanguageServicePluginOptions,
      LanguageServicePluginOptions.parse(settings)
    ),
    Nano.run
  )

  expect(test._tag).toBe("Right")
  if (test._tag === "Left") throw new Error("error in execution of nano")
  return {
    result: test.right,
    toFilename: (moduleName: string) => {
      const expectedResolution = ts.resolveModuleName(
        moduleName,
        sourceFile.fileName,
        program.getCompilerOptions(),
        program as any
      )
      if (!expectedResolution.resolvedModule) throw new Error("module " + moduleName + "  not found")
      return expectedResolution.resolvedModule.resolvedFileName
    }
  }
}

describe("autoimport", () => {
  describe("namespace import", () => {
    it("import { Effect } from 'effect'", () => {
      const { result, toFilename } = testAutoImport("Effect", "effect", { namespaceImportPackages: ["effect"] })
      expect(result).toEqual({
        _tag: "NamespaceImport",
        fileName: toFilename("effect/Effect"),
        moduleName: "effect/Effect",
        name: "Effect",
        introducedPrefix: undefined
      })
    })
    it("import { succeed } from 'effect/Effect'", () => {
      const { result, toFilename } = testAutoImport("succeed", "effect/Effect", { namespaceImportPackages: ["effect"] })
      expect(result).toEqual({
        _tag: "NamespaceImport",
        fileName: toFilename("effect/Effect"),
        moduleName: "effect/Effect",
        name: "Effect",
        introducedPrefix: "Effect"
      })
    })
    it("import { pipe } from 'effect'", () => {
      const { result } = testAutoImport("pipe", "effect", { namespaceImportPackages: ["effect"] })
      expect(result).toBeUndefined()
    })
    it("import { pipe } from 'effect' with topLevelNamedReexports: follow", () => {
      const { result, toFilename } = testAutoImport("pipe", "effect", {
        namespaceImportPackages: ["effect"],
        topLevelNamedReexports: "follow"
      })
      expect(result).toEqual({
        _tag: "NamedImport",
        fileName: toFilename("effect/Function"),
        moduleName: "effect/Function",
        name: "pipe",
        introducedPrefix: undefined
      })
    })
    it("import { pipe } from 'effect/Function'", () => {
      const { result, toFilename } = testAutoImport("pipe", "effect/Function", {
        namespaceImportPackages: ["effect"]
      })
      expect(result).toEqual({
        _tag: "NamespaceImport",
        fileName: toFilename("effect/Function"),
        moduleName: "effect/Function",
        name: "Function",
        introducedPrefix: "Function"
      })
    })
    it("import { pipe } from 'effect/Function' with topLevelNamedReexports: follow", () => {
      const { result, toFilename } = testAutoImport("pipe", "effect/Function", {
        namespaceImportPackages: ["effect"],
        topLevelNamedReexports: "follow"
      })
      expect(result).toEqual({
        _tag: "NamedImport",
        fileName: toFilename("effect/Function"),
        moduleName: "effect/Function",
        name: "pipe",
        introducedPrefix: undefined
      })
    })
  })
  describe("barrel import", () => {
    it("import { succeed } from 'effect/Effect'", () => {
      const { result, toFilename } = testAutoImport("succeed", "effect/Effect", { barrelImportPackages: ["effect"] })
      expect(result).toEqual({
        _tag: "NamedImport",
        fileName: toFilename("effect"),
        moduleName: "effect",
        name: "Effect",
        introducedPrefix: "Effect"
      })
    })
    it("import { pipe } from 'effect'", () => {
      const { result } = testAutoImport("pipe", "effect", { barrelImportPackages: ["effect"] })
      expect(result).toBeUndefined()
    })
    it("import { pipe } from 'effect'", () => {
      const { result } = testAutoImport("pipe", "effect", {
        barrelImportPackages: ["effect"],
        topLevelNamedReexports: "follow"
      })
      expect(result).toBeUndefined()
    })
  })
})
