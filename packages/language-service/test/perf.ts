import { pipe } from "effect/Function"
import * as Result from "effect/Result"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import * as LanguageServicePluginOptions from "../src/core/LanguageServicePluginOptions.js"
import * as LSP from "../src/core/LSP"
import * as Nano from "../src/core/Nano"
import * as TypeCheckerApi from "../src/core/TypeCheckerApi"
import * as TypeCheckerUtils from "../src/core/TypeCheckerUtils"
import * as TypeParser from "../src/core/TypeParser"
import * as TypeScriptApi from "../src/core/TypeScriptApi"
import * as TypeScriptUtils from "../src/core/TypeScriptUtils"
import { diagnostics } from "../src/diagnostics"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "..", "harness-effect-v3", "examples", "diagnostics")

function testAllDagnostics() {
  // read all filenames
  console.log("reading all example files")
  const allExampleFiles = fs.readdirSync(getExamplesDiagnosticsDir()).filter((fileName) => fileName.endsWith(".ts"))
  // run a couple of times
  console.log("running a couple of times")
  const totalSamples = 5
  let totalTime = 0
  let totalRuns = 0

  for (let i = 0; i < totalSamples; i++) {
    for (const exampleFileName of allExampleFiles) {
      const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), exampleFileName))
        .toString("utf8")
      const example = createServicesWithMockedVFS(exampleFileName, sourceText)
      totalRuns++
      if (totalRuns % 10 === 0) {
        console.log("executed ", totalRuns, " samples out of ", totalSamples * allExampleFiles.length)
      }
      const start = performance.now()
      pipe(
        LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, example.sourceFile),
        TypeParser.nanoLayer,
        TypeCheckerUtils.nanoLayer,
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, example.program.getTypeChecker()),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, example.program),
        TypeScriptUtils.nanoLayer,
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(LanguageServicePluginOptions.LanguageServicePluginOptions, {
          ...LanguageServicePluginOptions.defaults,
          refactors: false,
          diagnostics: true,
          quickinfo: false,
          completions: false,
          goto: false
        }),
        Nano.unsafeRun,
        Result.getOrElse(() => "// no diagnostics")
      )
      const end = performance.now()
      if (i !== -1) totalTime += end - start
    }
  }
  console.log(totalTime + " total " + (totalTime / totalRuns).toFixed(4) + " avg")
  console.log(Nano.getTimings().join("\n"))
}

testAllDagnostics()
