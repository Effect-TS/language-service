import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { effectRpcDefinition } from "@effect/language-service/goto/effectRpcDefinition"
import { pipe } from "effect/Function"
import * as Result from "effect/Result"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { getExamplesSubdir, getHarnessDir } from "./utils/harness.js"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

function runEffectRpcDefinition(
  applicableGotoDefinition: ts.DefinitionInfoAndBoundSpan | undefined,
  sourceFile: ts.SourceFile,
  position: number,
  program: ts.Program
) {
  return pipe(
    effectRpcDefinition(applicableGotoDefinition, sourceFile, position),
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.unsafeRun
  )
}

const fakeApplicable = (span: ts.TextSpan, fileName: string): ts.DefinitionInfoAndBoundSpan => ({
  textSpan: span,
  definitions: [{
    fileName,
    textSpan: { start: 0, length: 0 },
    kind: ts.ScriptElementKind.functionElement,
    name: "ImaginaryDefinition",
    containerKind: ts.ScriptElementKind.moduleElement,
    containerName: "ImaginaryContainer"
  }]
})

describe("effectRpcDefinition", () => {
  it(
    "preserves applicableGotoDefinition when clicking a JSX <Namespace.Component /> tag name",
    () => {
      const fileName = "/jsx.tsx"
      const sourceText = `
const Lib = { Component: () => null as any }
export const x = <Lib.Component />
`
      const { program, sourceFile } = createServicesWithMockedVFS(
        "/",
        "/",
        fileName,
        sourceText,
        { jsx: ts.JsxEmit.ReactJSX }
      )

      // Position the cursor in the middle of "Component" inside the JSX tag.
      const idx = sourceText.indexOf("Lib.Component") + "Lib.".length + 1
      const applicable = fakeApplicable(
        { start: idx, length: "Component".length },
        fileName
      )

      const result = runEffectRpcDefinition(applicable, sourceFile, idx, program)
      expect(Result.isSuccess(result)).toBe(true)
      // The bug: effectRpcDefinition returns `undefined` when the type
      // checker cannot resolve a JSX tag-name node, wiping the upstream
      // result. It must preserve `applicableGotoDefinition`.
      if (Result.isSuccess(result)) {
        expect(result.success).toEqual(applicable)
      }
    }
  )

  const fixtureFile = "rpc.ts"
  const fixturePath = path.join(getExamplesSubdir("goto"), fixtureFile)

  // The RPC enrichment fixture currently lives only in harness-effect-v3.
  it.skipIf(!fs.existsSync(fixturePath))(
    "enriches the definition with the server-side Rpc.fromTaggedRequest when clicking an RpcClient method call",
    () => {
      const sourceText = fs.readFileSync(fixturePath, "utf8")
      const { program, sourceFile } = createServicesWithMockedVFS(
        getHarnessDir(),
        path.dirname(path.dirname(fixturePath)),
        fixtureFile,
        sourceText
      )

      // Position cursor inside `MakeReservation` of `client.MakeReservation({...})`.
      const idx = sourceText.indexOf("MakeReservation({") + 1
      const applicable = fakeApplicable({ start: idx, length: "MakeReservation".length }, fixtureFile)

      const result = runEffectRpcDefinition(applicable, sourceFile, idx, program)
      expect(Result.isSuccess(result)).toBe(true)
      if (Result.isSuccess(result)) {
        const defs = result.success?.definitions ?? []
        const fromRpcDefs = defs.filter((d) => d.fileName.endsWith("rpc_defs.ts"))
        expect(fromRpcDefs.length).toBeGreaterThan(0)
      }
    }
  )
})
