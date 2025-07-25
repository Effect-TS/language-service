import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import * as LanguageServicePluginOptions from "../src/core/LanguageServicePluginOptions.js"
import * as LSP from "../src/core/LSP"
import * as Nano from "../src/core/Nano"
import * as TypeCheckerApi from "../src/core/TypeCheckerApi"
import * as TypeParser from "../src/core/TypeParser"
import * as TypeScriptApi from "../src/core/TypeScriptApi"
import * as TypeScriptUtils from "../src/core/TypeScriptUtils"
import { diagnostics } from "../src/diagnostics"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "examples", "diagnostics")

function testAllDagnostics() {
  // read all filenames
  console.log("reading all example files")
  const allExampleFiles = fs.readdirSync(getExamplesDiagnosticsDir()).filter((fileName) => fileName.endsWith(".ts"))
  // run a couple of times
  console.log("running a couple of times")
  const totalSamples = 1000
  let totalTime = 0
  for (const exampleFileName of allExampleFiles) {
    const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), exampleFileName))
      .toString("utf8")
    const example = createServicesWithMockedVFS(exampleFileName, sourceText)
    for (let i = -1; i < totalSamples; i++) {
      const start = performance.now()
      pipe(
        LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, example.sourceFile),
        TypeParser.nanoLayer,
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, example.program.getTypeChecker()),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, example.program),
        TypeScriptUtils.nanoLayer,
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(LanguageServicePluginOptions.LanguageServicePluginOptions, {
          diagnostics: true,
          diagnosticSeverity: {},
          quickinfo: false,
          completions: false,
          goto: false,
          allowedDuplicatedPackages: [],
          namespaceImportPackages: [],
          barrelImportPackages: []
        }),
        Nano.unsafeRun,
        Either.getOrElse(() => "// no diagnostics")
      )
      const end = performance.now()
      if (i !== -1) totalTime += end - start
    }
  }
  console.log(totalTime + " total " + (totalTime / totalSamples).toFixed(4) + " avg")
  console.log(Nano.getTimings().join("\n"))
}

testAllDagnostics()
