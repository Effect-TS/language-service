import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesPipingDir = () => path.join(__dirname, "..", "examples", "piping")

function formatPipingFlow(
  sourceFile: ts.SourceFile,
  flow: TypeParser.ParsedPipingFlow,
  typeChecker: ts.TypeChecker
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
  lines.push(`Subject Type: ${typeChecker.typeToString(flow.subject.outType)}`)
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

  return lines.join("\n")
}

function testPipingFlowsOnExample(
  fileName: string,
  sourceText: string
) {
  // create the language service with mocked services over a VFS
  const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)
  const typeChecker = program.getTypeChecker()

  // create snapshot path
  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "piping",
    fileName + ".output"
  )

  // attempt to run pipingFlows and get the output
  return pipe(
    Nano.service(TypeParser.TypeParser),
    Nano.flatMap((typeParser) => typeParser.pipingFlows(sourceFile)),
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
    Nano.map((flows) => {
      // Sort flows by position
      flows.sort((a, b) => a.node.getStart() - b.node.getStart())
      // Format flows
      return flows.length === 0
        ? "// no piping flows found"
        : flows.map((flow) => formatPipingFlow(sourceFile, flow, typeChecker)).join("\n\n")
    }),
    Nano.unsafeRun,
    async (result) => {
      expect(Either.isRight(result), "should run with no error " + result).toEqual(true)
      await expect(Either.getOrElse(result, () => "// error")).toMatchFileSnapshot(
        snapshotFilePath
      )
    }
  )
}

function testAllPipingFlows() {
  // read all filenames
  const exampleFiles = fs.readdirSync(getExamplesPipingDir())
    .filter((fileName) => fileName.endsWith(".ts"))

  describe("Piping Flows", () => {
    for (const fileName of exampleFiles) {
      const sourceText = fs.readFileSync(path.join(getExamplesPipingDir(), fileName))
        .toString("utf8")
      it(
        fileName,
        () => testPipingFlowsOnExample(fileName, sourceText)
      )
    }
  })
}

testAllPipingFlows()
