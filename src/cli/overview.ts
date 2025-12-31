import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { getFileNamesInTsConfig, TypeScriptContext } from "./utils"

export class NoFilesToCheckError extends Data.TaggedError("NoFilesToCheckError")<{}> {
  get message(): string {
    return "No files to check. Please provide an existing .ts file or a project tsconfig.json"
  }
}

interface ServiceInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly description: string | undefined
}

interface LayerInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly layerType: string
  readonly description: string | undefined
}

interface OverviewResult {
  readonly services: Array<ServiceInfo>
  readonly layers: Array<LayerInfo>
  readonly totalFilesCount: number
}

const BATCH_SIZE = 50

/**
 * Gets the location info from a declaration
 */
const getLocationFromDeclaration = (
  declaration: ts.Declaration,
  tsInstance: typeof ts
): { filePath: string; line: number; column: number } | undefined => {
  const sourceFile = declaration.getSourceFile()
  if (!sourceFile) return undefined
  const { character, line } = tsInstance.getLineAndCharacterOfPosition(sourceFile, declaration.getStart())
  return {
    filePath: sourceFile.fileName,
    line: line + 1,
    column: character + 1
  }
}

/**
 * Collects all exported services and layers from a source file using getExportsOfModule
 */
const collectExportedItems = (
  sourceFile: ts.SourceFile,
  tsInstance: typeof ts,
  typeChecker: ts.TypeChecker
): Nano.Nano<{ services: Array<ServiceInfo>; layers: Array<LayerInfo> }, never, TypeParser.TypeParser> =>
  Nano.gen(function*() {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const services: Array<ServiceInfo> = []
    const layers: Array<LayerInfo> = []

    // Get the module symbol for the source file
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) {
      return { services, layers }
    }

    // Get all exports from the module
    const exports = typeChecker.getExportsOfModule(moduleSymbol)

    for (const exportSymbol of exports) {
      const declarations = exportSymbol.getDeclarations()
      if (!declarations || declarations.length === 0) continue

      const declaration = declarations[0]
      const location = getLocationFromDeclaration(declaration, tsInstance)
      if (!location) continue

      const name = tsInstance.symbolName(exportSymbol)
      const type = typeChecker.getTypeOfSymbol(exportSymbol)

      // Get JSDoc description if available
      const docComment = exportSymbol.getDocumentationComment(typeChecker)
      const description = docComment.length > 0
        ? docComment.map((part) => part.text).join("")
        : undefined

      // Check if it's a Context.Tag (has _Identifier and _Service variance)
      const contextTagResult = yield* pipe(
        typeParser.contextTag(type, declaration),
        Nano.option
      )
      if (Option.isSome(contextTagResult)) {
        services.push({
          name,
          ...location,
          description
        })
        continue
      }

      // Check if it's a Layer
      const layerResult = yield* pipe(
        typeParser.layerType(type, declaration),
        Nano.option
      )
      if (Option.isSome(layerResult)) {
        const rOut = typeChecker.typeToString(layerResult.value.ROut)
        const e = typeChecker.typeToString(layerResult.value.E)
        const rIn = typeChecker.typeToString(layerResult.value.RIn)
        layers.push({
          name,
          ...location,
          layerType: `Layer<${rOut}, ${e}, ${rIn}>`,
          description
        })
        continue
      }
    }

    return { services, layers }
  })

/**
 * Converts an absolute path to a relative path from cwd
 */
const toRelativePath = (absolutePath: string, cwd: string): string => {
  if (absolutePath.startsWith(cwd)) {
    const relative = absolutePath.slice(cwd.length)
    return relative.startsWith("/") ? `.${relative}` : `./${relative}`
  }
  return absolutePath
}

/**
 * Renders a dim text line
 */
const dimLine = (text: string): Doc.AnsiDoc => Doc.annotate(Doc.text(text), Ansi.blackBright)

/**
 * Renders a service item
 */
const renderService = (svc: ServiceInfo, cwd: string): Doc.AnsiDoc => {
  const relativePath = toRelativePath(svc.filePath, cwd)
  const details: Array<Doc.AnsiDoc> = [
    dimLine(`${relativePath}:${svc.line}:${svc.column}`)
  ]
  if (svc.description) {
    details.push(dimLine(svc.description))
  }

  return Doc.vsep([
    Doc.text(svc.name),
    Doc.indent(Doc.vsep(details), 2),
    Doc.empty
  ])
}

/**
 * Renders a layer item
 */
const renderLayer = (layer: LayerInfo, cwd: string): Doc.AnsiDoc => {
  const relativePath = toRelativePath(layer.filePath, cwd)
  const details: Array<Doc.AnsiDoc> = [
    dimLine(`${relativePath}:${layer.line}:${layer.column}`),
    dimLine(layer.layerType)
  ]
  if (layer.description) {
    details.push(dimLine(layer.description))
  }

  return Doc.vsep([
    Doc.text(layer.name),
    Doc.indent(Doc.vsep(details), 2),
    Doc.empty
  ])
}

/**
 * Renders the overview result as a styled document
 */
const renderOverview = (result: OverviewResult, cwd: string): Doc.AnsiDoc => {
  const lines: Array<Doc.AnsiDoc> = []

  lines.push(Doc.text(`Overview for ${result.totalFilesCount} file(s).`))

  // Services section
  if (result.services.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Services (${result.services.length})`), Ansi.bold))
    const serviceDocs = result.services.map((svc) => renderService(svc, cwd))
    lines.push(Doc.indent(Doc.vsep(serviceDocs), 2))
  }

  // Layers section
  if (result.layers.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Layers (${result.layers.length})`), Ansi.bold))
    const layerDocs = result.layers.map((layer) => renderLayer(layer, cwd))
    lines.push(Doc.indent(Doc.vsep(layerDocs), 2))
  }

  if (result.services.length === 0 && result.layers.length === 0) {
    lines.push(Doc.empty)
    lines.push(Doc.text("No exported services or layers found."))
  }

  return Doc.vsep(lines)
}

export const overview = Command.make(
  "overview",
  {
    file: Options.file("file").pipe(
      Options.optional,
      Options.withDescription("The full path of the file to analyze.")
    ),
    project: Options.file("project").pipe(
      Options.optional,
      Options.withDescription("The full path of the project tsconfig.json file to analyze.")
    )
  },
  Effect.fn("overview")(function*({ file, project }) {
    const path = yield* Path.Path
    const cwd = path.resolve(".")
    const tsInstance = yield* TypeScriptContext

    const filesToCheck = Option.isSome(project)
      ? yield* getFileNamesInTsConfig(project.value)
      : new Set<string>()

    if (Option.isSome(file)) {
      filesToCheck.add(path.resolve(file.value))
    }

    if (filesToCheck.size === 0) {
      return yield* new NoFilesToCheckError()
    }

    const services: Array<ServiceInfo> = []
    const layers: Array<LayerInfo> = []

    for (const batch of Array.chunksOf(filesToCheck, BATCH_SIZE)) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        service.openClientFile(filePath)
        try {
          const scriptInfo = service.getScriptInfo(filePath)
          if (!scriptInfo) continue

          const projectInfo = scriptInfo.getDefaultProject()
          const languageService = projectInfo.getLanguageService(true)
          const program = languageService.getProgram()
          if (!program) continue
          const sourceFile = program.getSourceFile(filePath)
          if (!sourceFile) continue

          const result = pipe(
            collectExportedItems(sourceFile, tsInstance, program.getTypeChecker()),
            TypeParser.nanoLayer,
            TypeCheckerUtils.nanoLayer,
            TypeScriptUtils.nanoLayer,
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
            Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
            Nano.run,
            Either.getOrElse(() => ({ services: [], layers: [] }))
          )

          for (const svc of result.services) {
            services.push(svc)
          }
          for (const layer of result.layers) {
            layers.push(layer)
          }
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow()
    }

    const doc = renderOverview({ services, layers, totalFilesCount: filesToCheck.size }, cwd)
    yield* Console.log(Doc.render(doc, { style: "pretty" }))
  })
).pipe(
  Command.withDescription("Provides an overview of Effect-related exports in the given files or project.")
)
