import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import * as LSP from "../src/core/LSP"
import * as Nano from "../src/core/Nano"
import * as TypeCheckerApi from "../src/core/TypeCheckerApi"
import * as TypeScriptApi from "../src/core/TypeScriptApi"
import { diagnostics } from "../src/diagnostics"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "examples", "diagnostics")

function testAllDagnostics() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesDiagnosticsDir()).filter((fileName) =>
    fileName.endsWith(".ts")
  ).map(
    (fileName) => {
      const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), fileName))
        .toString("utf8")
      return createServicesWithMockedVFS(fileName, sourceText)
    }
  )
  // run a couple of times
  const totalSamples = 1000
  let totalTime = 0
  for (let i = 0; i < totalSamples; i++) {
    for (const example of allExampleFiles) {
      const start = performance.now()
      pipe(
        LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, example.sourceFile),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, example.program),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, example.program.getTypeChecker()),
        Nano.provideService(
          TypeCheckerApi.TypeCheckerApiCache,
          TypeCheckerApi.makeTypeCheckerApiCache()
        ),
        Nano.provideService(LSP.PluginOptions, {
          diagnostics: true,
          quickinfo: false,
          completions: false,
          multipleEffectCheck: true
        }),
        Nano.unsafeRun,
        Either.getOrElse(() => "// no diagnostics")
      )
      const end = performance.now()
      totalTime += end - start
    }
  }
  console.log(totalTime + " total " + (totalTime / totalSamples).toFixed(4) + " avg")
}

testAllDagnostics()
