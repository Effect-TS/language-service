import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import * as String from "effect/String"
import { Command, Flag } from "effect/unstable/cli"

import type * as ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { ansi, BOLD, DIM } from "./ansi"
import { getFileNamesInTsConfig, TypeScriptContext } from "./utils"
import * as ExportedSymbols from "./utils/ExportedSymbols"
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

export interface ServiceInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly serviceType: string
  readonly description: string | undefined
}

export interface LayerInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly layerType: string
  readonly description: string | undefined
  readonly tsInfo?: { readonly node: ts.Node; readonly type: ts.Type } | undefined
}

export interface ErrorInfo {
  readonly name: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly errorType: string
  readonly description: string | undefined
}

export interface ExportedItemsResult {
  readonly services: Array<ServiceInfo>
  readonly layers: Array<LayerInfo>
  readonly errors: Array<ErrorInfo>
}

export interface OverviewResult extends ExportedItemsResult {
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
 * Collects all exported services, layers, and errors from a source file.
 * Uses ExportedSymbols to get all exported symbols with their names and locations,
 * then checks each symbol's type to categorize it.
 *
 * @param sourceFile - The source file to collect exports from
 * @param tsInstance - The TypeScript instance
 * @param typeChecker - The TypeScript type checker
 * @param maxSymbolDepth - Maximum depth to traverse nested properties (default: 3)
 * @param includeTsInfo - If true, includes tsInfo (node and type) for layers (for layerinfo command)
 */
export function collectExportedItems(
  sourceFile: ts.SourceFile,
  tsInstance: typeof ts,
  typeChecker: ts.TypeChecker,
  maxSymbolDepth: number = 3,
  includeTsInfo: boolean = false
): Nano.Nano<ExportedItemsResult, never, TypeParser.TypeParser> {
  return Nano.gen(function*() {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const services: Array<ServiceInfo> = []
    const layers: Array<LayerInfo> = []
    const errors: Array<ErrorInfo> = []

    // Get all exported symbols with their names and locations
    const exportedSymbols = ExportedSymbols.collectSourceFileExportedSymbols(
      sourceFile,
      tsInstance,
      typeChecker,
      maxSymbolDepth
    )

    for (const { description, location, name, symbol, type } of exportedSymbols) {
      // Get a declaration for type parsing context
      const declarations = symbol.declarations
      const declaration = declarations && declarations.length > 0 ? declarations[0] : sourceFile

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
        const layerInfo: LayerInfo = {
          name,
          ...location,
          layerType: typeToString(typeChecker, tsInstance, type),
          description,
          tsInfo: includeTsInfo ? { node: declaration, type } : undefined
        }
        layers.push(layerInfo)
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
}

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
 * Renders a service item
 */
const renderService = (svc: ServiceInfo, cwd: string): string => {
  const relativePath = toRelativePath(svc.filePath, cwd)
  const details = [
    ansi(`${relativePath}:${svc.line}:${svc.column}`, DIM),
    ansi(svc.serviceType, DIM)
  ]
  if (svc.description) {
    details.push(ansi(svc.description, DIM))
  }
  return [
    `  ${svc.name}`,
    ...details.map((d) => `    ${d}`),
    ""
  ].join("\n")
}

/**
 * Renders a layer item
 */
const renderLayer = (layer: LayerInfo, cwd: string): string => {
  const relativePath = toRelativePath(layer.filePath, cwd)
  const details = [
    ansi(`${relativePath}:${layer.line}:${layer.column}`, DIM),
    ansi(layer.layerType, DIM)
  ]
  if (layer.description) {
    details.push(ansi(layer.description, DIM))
  }
  return [
    `  ${layer.name}`,
    ...details.map((d) => `    ${d}`),
    ""
  ].join("\n")
}

/**
 * Renders an error item
 */
const renderError = (error: ErrorInfo, cwd: string): string => {
  const relativePath = toRelativePath(error.filePath, cwd)
  const details = [
    ansi(`${relativePath}:${error.line}:${error.column}`, DIM),
    ansi(error.errorType, DIM)
  ]
  if (error.description) {
    details.push(ansi(error.description, DIM))
  }
  return [
    `  ${error.name}`,
    ...details.map((d) => `    ${d}`),
    ""
  ].join("\n")
}

/**
 * Renders the overview result as a styled string
 */
export const renderOverview = (result: OverviewResult, cwd: string): string => {
  const lines: Array<string> = []

  // Errors section
  if (result.errors.length > 0) {
    lines.push("")
    lines.push(ansi(`Yieldable Errors (${result.errors.length})`, BOLD))
    const sortedErrors = Array.sort(result.errors, itemOrder)
    for (const error of sortedErrors) {
      lines.push(renderError(error, cwd))
    }
  }

  // Services section
  if (result.services.length > 0) {
    lines.push("")
    lines.push(ansi(`Services (${result.services.length})`, BOLD))
    const sortedServices = Array.sort(result.services, itemOrder)
    for (const svc of sortedServices) {
      lines.push(renderService(svc, cwd))
    }
  }

  // Layers section
  if (result.layers.length > 0) {
    lines.push("")
    lines.push(ansi(`Layers (${result.layers.length})`, BOLD))
    const sortedLayers = Array.sort(result.layers, itemOrder)
    for (const layer of sortedLayers) {
      lines.push(renderLayer(layer, cwd))
    }
  }

  if (result.services.length === 0 && result.layers.length === 0 && result.errors.length === 0) {
    lines.push("")
    lines.push("No exported services, layers, or errors found.")
  }

  // Hint for getting automatic composition
  if (result.layers.length > 0) {
    lines.push("")
    lines.push(
      ansi(
        "Tip: Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...) command, and then run the layerinfo command to get the suggested composition order to use.",
        DIM
      )
    )
  }

  return lines.join("\n")
}

/**
 * Collects all services, layers, and errors from the given files
 */
const collectAllItems = (
  filesToCheck: Set<string>,
  tsInstance: typeof ts,
  maxSymbolDepth: number,
  onProgress: (current: number, total: number) => Effect.Effect<void>
): Effect.Effect<ExportedItemsResult> =>
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
            collectExportedItems(sourceFile, tsInstance, program.getTypeChecker(), maxSymbolDepth),
            TypeParser.nanoLayer,
            TypeCheckerUtils.nanoLayer,
            TypeScriptUtils.nanoLayer,
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
            Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
            Nano.run,
            Result.getOrElse(() => ({ services: [], layers: [], errors: [] }))
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
      yield* Effect.yieldNow
    }

    return { services, layers, errors }
  })

export const overview = Command.make(
  "overview",
  {
    file: Flag.file("file").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the file to analyze.")
    ),
    project: Flag.file("project").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the project tsconfig.json file to analyze.")
    ),
    maxSymbolDepth: Flag.integer("max-symbol-depth").pipe(
      Flag.withDefault(3),
      Flag.withDescription(
        "Maximum depth to traverse nested symbol properties. 0 = only root exports, 1 = root + one level, etc."
      )
    )
  },
  Effect.fn("overview")(function*({ file, maxSymbolDepth, project }) {
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
          maxSymbolDepth,
          (current, total) => handle.updateMessage(`Processing file ${current}/${total}...`)
        ),
      {
        message: `Processing ${totalFiles} file(s)...`,
        onSuccess: () => `Processed ${totalFiles} file(s)`
      }
    )

    const output = renderOverview({ services, layers, errors, totalFilesCount: filesToCheck.size }, cwd)
    yield* Console.log(output)
  })
).pipe(
  Command.withDescription("Provides an overview of Effect-related exports in the given files or project.")
)
