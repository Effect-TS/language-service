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
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as String from "effect/String"

import type * as ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { getFileNamesInTsConfig, TypeScriptContext } from "./utils"
import * as Spinner from "./utils/Spinner"

/**
 * Order for items by filePath, line, column, then name
 */
const itemOrder: Order.Order<{ filePath: string; line: number; column: number; name: string }> = Order.combine(
  Order.mapInput(String.Order, (_) => _.filePath),
  Order.combine(
    Order.mapInput(Number.Order, (_) => _.line),
    Order.combine(
      Order.mapInput(Number.Order, (_) => _.column),
      Order.mapInput(String.Order, (_) => _.name)
    )
  )
)

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
  readonly serviceType: string
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

interface ErrorInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly errorType: string
  readonly description: string | undefined
}

interface OverviewResult {
  readonly services: Array<ServiceInfo>
  readonly layers: Array<LayerInfo>
  readonly errors: Array<ErrorInfo>
  readonly totalFilesCount: number
}

const BATCH_SIZE = 50

/**
 * Converts a type to string without truncation
 */
const typeToString = (
  typeChecker: ts.TypeChecker,
  tsInstance: typeof ts,
  type: ts.Type
): string => typeChecker.typeToString(type, undefined, tsInstance.TypeFormatFlags.NoTruncation)

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
 * Collects all exported services, layers, and errors from a source file using getExportsOfModule
 * Also traverses properties of exported symbols to find nested services/layers (e.g., Effect.Service.Default)
 */
const collectExportedItems = (
  sourceFile: ts.SourceFile,
  tsInstance: typeof ts,
  typeChecker: ts.TypeChecker
): Nano.Nano<
  { services: Array<ServiceInfo>; layers: Array<LayerInfo>; errors: Array<ErrorInfo> },
  never,
  TypeParser.TypeParser
> =>
  Nano.gen(function*() {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const services: Array<ServiceInfo> = []
    const layers: Array<LayerInfo> = []
    const errors: Array<ErrorInfo> = []

    // Get the module symbol for the source file
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) {
      return { services, layers, errors }
    }

    // Get all exports from the module
    const exports = typeChecker.getExportsOfModule(moduleSymbol)

    type CodeLocation = { filePath: string; line: number; column: number }

    // Work queue: [symbol, qualifiedName, codeLocation | undefined]
    // Initialize with exported symbols using their names and declaration locations
    const workQueue: Array<[ts.Symbol, string, CodeLocation | undefined]> = exports.map((s) => {
      const declarations = s.getDeclarations()
      const location = declarations && declarations.length > 0
        ? getLocationFromDeclaration(declarations[0], tsInstance)
        : undefined
      return [s, tsInstance.symbolName(s), location]
    })
    // Track which symbols have been exploded (properties added to queue)
    const exploded = new WeakSet<ts.Symbol>()

    while (workQueue.length > 0) {
      const [symbol, name, location] = workQueue.shift()!

      if (!location) continue

      const type = typeChecker.getTypeOfSymbol(symbol)

      // Explode symbol: add its properties to the queue (only once per symbol)
      // Child symbols inherit the parent's code location
      if (!exploded.has(symbol)) {
        exploded.add(symbol)

        const properties = typeChecker.getPropertiesOfType(type)
        for (const propSymbol of properties) {
          const propName = tsInstance.symbolName(propSymbol)
          // Skip prototype property - it contains instance type, not a real export
          if (propName === "prototype") continue
          const childName = `${name}.${propName}`
          workQueue.push([propSymbol, childName, location])
        }
      }

      // Get a declaration for type parsing context
      const declarations = symbol.getDeclarations()
      const declaration = declarations && declarations.length > 0 ? declarations[0] : sourceFile

      // Get JSDoc description if available
      const docComment = symbol.getDocumentationComment(typeChecker)
      const description = docComment.length > 0
        ? docComment.map((part) => part.text).join("")
        : undefined

      // Check if it's a Context.Tag (has _Identifier and _Service variance)
      const contextTagResult = yield* pipe(
        typeParser.contextTag(type, declaration),
        Nano.option
      )
      if (Option.isSome(contextTagResult)) {
        const serviceType = typeToString(typeChecker, tsInstance, contextTagResult.value.Service)
        services.push({
          name,
          ...location,
          serviceType,
          description
        })
      }

      // Check if it's a Layer (directly or a function returning a layer)
      let isLayer = false
      const directLayerResult = yield* pipe(
        typeParser.layerType(type, declaration),
        Nano.option
      )
      if (Option.isSome(directLayerResult)) {
        isLayer = true
      } else {
        // Check if it's a function that returns a layer
        const callSignatures = typeChecker.getSignaturesOfType(type, tsInstance.SignatureKind.Call)
        for (const sig of callSignatures) {
          const returnType = typeChecker.getReturnTypeOfSignature(sig)
          const returnLayerResult = yield* pipe(
            typeParser.layerType(returnType, declaration),
            Nano.option
          )
          if (Option.isSome(returnLayerResult)) {
            isLayer = true
            break
          }
        }
      }
      if (isLayer) {
        layers.push({
          name,
          ...location,
          layerType: typeToString(typeChecker, tsInstance, type),
          description
        })
      }

      // Check if it's a YieldableError
      // First try the type directly, then try instance types from construct signatures
      let isError = false
      let errorType = type
      const directErrorResult = yield* pipe(
        typeParser.extendsCauseYieldableError(type),
        Nano.option
      )
      if (Option.isSome(directErrorResult)) {
        isError = true
        errorType = type
      } else {
        // Check if it's a constructor that returns an error
        const constructSignatures = typeChecker.getSignaturesOfType(type, tsInstance.SignatureKind.Construct)
        for (const sig of constructSignatures) {
          const instanceType = typeChecker.getReturnTypeOfSignature(sig)
          const instanceErrorResult = yield* pipe(
            typeParser.extendsCauseYieldableError(instanceType),
            Nano.option
          )
          if (Option.isSome(instanceErrorResult)) {
            isError = true
            errorType = instanceType
            break
          }
        }
      }
      if (isError) {
        errors.push({
          name,
          ...location,
          errorType: typeToString(typeChecker, tsInstance, errorType),
          description
        })
      }
    }

    return { services, layers, errors }
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
    dimLine(`${relativePath}:${svc.line}:${svc.column}`),
    dimLine(svc.serviceType)
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
 * Renders an error item
 */
const renderError = (error: ErrorInfo, cwd: string): Doc.AnsiDoc => {
  const relativePath = toRelativePath(error.filePath, cwd)
  const details: Array<Doc.AnsiDoc> = [
    dimLine(`${relativePath}:${error.line}:${error.column}`),
    dimLine(error.errorType)
  ]
  if (error.description) {
    details.push(dimLine(error.description))
  }

  return Doc.vsep([
    Doc.text(error.name),
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

  // Errors section
  if (result.errors.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Yieldable Errors (${result.errors.length})`), Ansi.bold))
    const sortedErrors = Array.sort(result.errors, itemOrder)
    const errorDocs = sortedErrors.map((error) => renderError(error, cwd))
    lines.push(Doc.indent(Doc.vsep(errorDocs), 2))
  }

  // Services section
  if (result.services.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Services (${result.services.length})`), Ansi.bold))
    const sortedServices = Array.sort(result.services, itemOrder)
    const serviceDocs = sortedServices.map((svc) => renderService(svc, cwd))
    lines.push(Doc.indent(Doc.vsep(serviceDocs), 2))
  }

  // Layers section
  if (result.layers.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Layers (${result.layers.length})`), Ansi.bold))
    const sortedLayers = Array.sort(result.layers, itemOrder)
    const layerDocs = sortedLayers.map((layer) => renderLayer(layer, cwd))
    lines.push(Doc.indent(Doc.vsep(layerDocs), 2))
  }

  if (result.services.length === 0 && result.layers.length === 0 && result.errors.length === 0) {
    lines.push(Doc.empty)
    lines.push(Doc.text("No exported services, layers, or errors found."))
  }

  return Doc.vsep(lines)
}

/**
 * Collects all services, layers, and errors from the given files
 */
const collectAllItems = (
  filesToCheck: Set<string>,
  tsInstance: typeof ts,
  onProgress: (current: number, total: number) => Effect.Effect<void>
): Effect.Effect<{ services: Array<ServiceInfo>; layers: Array<LayerInfo>; errors: Array<ErrorInfo> }> =>
  Effect.gen(function*() {
    const services: Array<ServiceInfo> = []
    const layers: Array<LayerInfo> = []
    const errors: Array<ErrorInfo> = []

    const totalFiles = filesToCheck.size
    let processedFiles = 0

    for (const batch of Array.chunksOf(filesToCheck, BATCH_SIZE)) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        processedFiles++
        yield* onProgress(processedFiles, totalFiles)

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
            Either.getOrElse(() => ({ services: [], layers: [], errors: [] }))
          )

          for (const svc of result.services) {
            services.push(svc)
          }
          for (const layer of result.layers) {
            layers.push(layer)
          }
          for (const error of result.errors) {
            errors.push(error)
          }
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow()
    }

    return { services, layers, errors }
  })

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

    const totalFiles = filesToCheck.size
    const { errors, layers, services } = yield* Spinner.spinner(
      (handle) =>
        collectAllItems(
          filesToCheck,
          tsInstance,
          (current, total) => handle.updateMessage(`Processing file ${current}/${total}...`)
        ),
      {
        message: `Processing ${totalFiles} file(s)...`,
        onSuccess: () => `Processed ${totalFiles} file(s)`
      }
    )

    const doc = renderOverview({ services, layers, errors, totalFilesCount: filesToCheck.size }, cwd)
    yield* Console.log(Doc.render(doc, { style: "pretty" }))
  })
).pipe(
  Command.withDescription("Provides an overview of Effect-related exports in the given files or project.")
)
