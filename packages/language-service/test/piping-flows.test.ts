import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { pipe } from "effect/Function"
import * as Result from "effect/Result"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { getExamplesSubdir, getSnapshotsSubdir, safeReaddirSync } from "./utils/harness.js"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesPipingDir = () => getExamplesSubdir("piping")

function formatPipingFlow(
  sourceFile: ts.SourceFile,
  flow: TypeParser.ParsedPipingFlow,
  typeChecker: ts.TypeChecker,
  reconstructPipingFlow: TypeParser.TypeParser["reconstructPipingFlow"]
): string {
  const lines: Array<string> = []

  // Get position info for the outer node
  const startPos = flow.node.getStart()
  const endPos = flow.node.getEnd()
  const start = ts.getLineAndCharacterOfPosition(sourceFile, startPos)
  const end = ts.getLineAndCharacterOfPosition(sourceFile, endPos)

  lines.push(`=== Piping Flow ===`)
  lines.push(`Location: ${start.line + 1}:${start.character + 1} - ${end.line + 1}:${end.character + 1}`)
  lines.push(`Node: ${flow.node.getText().replace(/\n/g, "\\n")}`)
  lines.push(`Node Kind: ${ts.SyntaxKind[flow.node.kind]}`)
  lines.push(``)
  lines.push(`Subject: ${flow.subject.node.getText().replace(/\n/g, "\\n")}`)
  lines.push(`Subject Type: ${flow.subject.outType ? typeChecker.typeToString(flow.subject.outType) : "unknown"}`)
  lines.push(``)
  lines.push(`Transformations (${flow.transformations.length}):`)

  for (let i = 0; i < flow.transformations.length; i++) {
    const t = flow.transformations[i]
    const calleeText = t.callee.getText()
    const argsText = t.args ? t.args.map((a) => a.getText().replace(/\n/g, "\\n")).join(", ") : undefined
    const typeText = t.outType ? typeChecker.typeToString(t.outType) : "unknown"

    lines.push(`  [${i}] kind: ${t.kind}`)
    lines.push(`      callee: ${calleeText}`)
    lines.push(`      args: ${argsText !== undefined ? `[${argsText}]` : "(constant)"}`)
    lines.push(`      outType: ${typeText}`)
  }

  // Add reconstructed piping flow
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  const reconstructed = reconstructPipingFlow(flow)
  const reconstructedText = printer.printNode(ts.EmitHint.Expression, reconstructed, sourceFile)
  lines.push(``)
  lines.push(`Reconstructed: ${reconstructedText.replace(/\n/g, "\\n")}`)

  return lines.join("\n")
}

function testPipingFlowsOnExample(
  fileName: string,
  sourceText: string,
  includeEffectFn: boolean
) {
  // create the language service with mocked services over a VFS
  const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)
  const typeChecker = program.getTypeChecker()

  // create snapshot path
  const snapshotFilePath = path.join(
    getSnapshotsSubdir("piping"),
    fileName + ".output"
  )

  // attempt to run pipingFlows and get the output
  return pipe(
    Nano.service(TypeParser.TypeParser),
    Nano.flatMap((typeParser) =>
      Nano.map(
        typeParser.pipingFlows(includeEffectFn)(sourceFile),
        (flows) => ({ flows, reconstructPipingFlow: typeParser.reconstructPipingFlow })
      )
    ),
    TypeParser.nanoLayer,
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(
      LanguageServicePluginOptions.LanguageServicePluginOptions,
      LanguageServicePluginOptions.parse({
        ...LanguageServicePluginOptions.defaults,
        namespaceImportPackages: ["effect"]
      })
    ),
    Nano.map(({ flows, reconstructPipingFlow }) => {
      // Sort flows by position
      flows.sort((a, b) => a.node.getStart() - b.node.getStart())
      // Format flows
      return flows.length === 0
        ? "// no piping flows found"
        : flows.map((flow) => formatPipingFlow(sourceFile, flow, typeChecker, reconstructPipingFlow)).join("\n\n")
    }),
    Nano.unsafeRun,
    async (result) => {
      expect(Result.isSuccess(result), "should run with no error " + result).toEqual(true)
      await expect(Result.getOrElse(result, () => "// error")).toMatchFileSnapshot(
        snapshotFilePath
      )
    }
  )
}

function testAllPipingFlows() {
  // read all filenames
  const exampleFiles = safeReaddirSync(getExamplesPipingDir())
    .filter((fileName) => fileName.endsWith(".ts"))

  // skip all tests if no example files exist for this harness
  if (exampleFiles.length === 0) {
    describe("Piping Flows (skipped - no example files)", () => {
      it.skip("no example files for this harness", () => {})
    })
    return
  }

  describe("Piping Flows", () => {
    for (const fileName of exampleFiles) {
      const sourceText = fs.readFileSync(path.join(getExamplesPipingDir(), fileName))
        .toString("utf8")
      // Use includeEffectFn: true for effectFn*.ts files
      const includeEffectFn = fileName.startsWith("effectFn")
      it(
        fileName,
        () => testPipingFlowsOnExample(fileName, sourceText, includeEffectFn)
      )
    }
  })
}

testAllPipingFlows()
