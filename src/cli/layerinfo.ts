import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"

import type * as ts from "typescript"
import * as LayerGraph from "../core/LayerGraph"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { collectExportedItems, type LayerInfo } from "./overview"
import { TypeScriptContext } from "./utils"

/**
 * Error when the specified layer is not found
 */
export class LayerNotFoundError {
  readonly _tag = "LayerNotFoundError"
  constructor(
    readonly name: string,
    readonly availableLayers: ReadonlyArray<string>
  ) {}
  get message(): string {
    if (this.availableLayers.length === 0) {
      return `Layer "${this.name}" not found. No layers are exported from this file.`
    }
    return `Layer "${this.name}" not found. Available layers: ${this.availableLayers.join(", ")}`
  }
  toString(): string {
    return this.message
  }
}

/**
 * Provider/Requirer info as plain strings for display (no ts.Node or ts.Type references)
 */
export interface LayerProviderRequirerDisplayInfo {
  readonly kind: "provided" | "required"
  readonly typeString: string
}

/**
 * A single step in the suggested layer composition
 */
export interface CompositionStep {
  readonly operation: "provide" | "provideMerge" | "merge"
  readonly layerName: string
}

/**
 * Result of layer-info command - contains only serializable data
 */
export interface LayerInfoResult {
  readonly layer: LayerInfo
  readonly providersAndRequirers: ReadonlyArray<LayerProviderRequirerDisplayInfo>
  readonly suggestedComposition: ReadonlyArray<CompositionStep> | undefined
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
 * Renders a dim text line
 */
const dimLine = (text: string): Doc.AnsiDoc => Doc.annotate(Doc.text(text), Ansi.blackBright)

/**
 * Renders the layer info result as a styled document
 */
export const renderLayerInfo = (result: LayerInfoResult, cwd: string): Doc.AnsiDoc => {
  const { layer, providersAndRequirers } = result
  const lines: Array<Doc.AnsiDoc> = []

  // Header with layer name
  lines.push(Doc.empty)
  lines.push(Doc.annotate(Doc.text(layer.name), Ansi.bold))

  // Location and type indented under the name
  const relativePath = toRelativePath(layer.filePath, cwd)
  lines.push(Doc.indent(dimLine(`${relativePath}:${layer.line}:${layer.column}`), 2))
  lines.push(Doc.indent(dimLine(layer.layerType), 2))

  // Description if present
  if (layer.description) {
    lines.push(Doc.indent(dimLine(layer.description), 2))
  }

  // Providers and Requirers
  const providedItems = providersAndRequirers.filter((_) => _.kind === "provided")
  const requiredItems = providersAndRequirers.filter((_) => _.kind === "required")

  if (providedItems.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Provides (${providedItems.length}):`), Ansi.bold))
    for (const item of providedItems) {
      lines.push(Doc.indent(dimLine(`- ${item.typeString}`), 2))
    }
  }

  if (requiredItems.length > 0) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text(`Requires (${requiredItems.length}):`), Ansi.bold))
    for (const item of requiredItems) {
      lines.push(Doc.indent(dimLine(`- ${item.typeString}`), 2))
    }
  }

  if (providedItems.length === 0 && requiredItems.length === 0) {
    lines.push(Doc.empty)
    lines.push(dimLine("No providers or requirements detected."))
  }

  // Suggested Composition
  if (result.suggestedComposition && result.suggestedComposition.length > 1) {
    lines.push(Doc.empty)
    lines.push(Doc.annotate(Doc.text("Suggested Composition:"), Ansi.bold))
    const [first, ...rest] = result.suggestedComposition
    lines.push(Doc.indent(dimLine(first!.layerName + ".pipe("), 2))
    for (let i = 0; i < rest.length; i++) {
      const step = rest[i]!
      const suffix = i === rest.length - 1 ? "" : ","
      lines.push(Doc.indent(dimLine(`Layer.${step.operation}(${step.layerName})${suffix}`), 4))
    }
    lines.push(Doc.indent(dimLine(")"), 2))
  }

  // Hint for getting automatic composition
  lines.push(Doc.empty)
  lines.push(
    dimLine(
      "Tip: Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...) command, and then run the layerinfo command to get the suggested composition order to use."
    )
  )

  return Doc.vsep(lines)
}

/**
 * Details collected from a layer expression
 */
interface LayerDetails {
  readonly providersAndRequirers: ReadonlyArray<LayerProviderRequirerDisplayInfo>
  readonly suggestedComposition: ReadonlyArray<CompositionStep> | undefined
}

/**
 * Collects detailed layer information from a layer expression node.
 * Returns only serializable data (strings, primitives) - no ts.Node or ts.Type references.
 */
const collectLayerDetailsFromExpression = (
  layerExpression: ts.Expression
): Nano.Nano<
  LayerDetails,
  LayerGraph.UnableToProduceLayerGraphError,
  | TypeScriptApi.TypeScriptApi
  | TypeCheckerApi.TypeCheckerApi
  | TypeParser.TypeParser
  | TypeCheckerUtils.TypeCheckerUtils
  | TypeScriptUtils.TypeScriptUtils
> =>
  Nano.gen(function*() {
    const typeCheckerRef = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const tsRef = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const layerGraph = yield* LayerGraph.extractLayerGraph(layerExpression, {
      arrayLiteralAsMerge: true,
      explodeOnlyLayerCalls: false,
      followSymbolsDepth: 0
    })

    const providersAndRequirers = yield* LayerGraph.extractProvidersAndRequirers(layerGraph)

    // Convert to plain strings for display (no ts.Type/ts.Node references)
    const displayInfo: Array<LayerProviderRequirerDisplayInfo> = providersAndRequirers.map((item) => ({
      kind: item.kind,
      typeString: typeCheckerRef.typeToString(
        item.type,
        undefined,
        tsRef.TypeFormatFlags.NoTruncation
      )
    }))

    // Try to compute suggested composition
    const suggestedComposition = yield* pipe(
      Nano.gen(function*() {
        // Extract layer graph with explodeOnlyLayerCalls for composition
        const compositionGraph = yield* LayerGraph.extractLayerGraph(layerExpression, {
          arrayLiteralAsMerge: true,
          explodeOnlyLayerCalls: true,
          followSymbolsDepth: 0
        })

        const outlineGraph = yield* LayerGraph.extractOutlineGraph(compositionGraph)

        // Get the target output type from the layer
        const layerType = typeCheckerRef.getTypeAtLocation(layerExpression)
        const parsedLayer = yield* typeParser.layerType(layerType, layerExpression)

        const { layerMagicNodes } = yield* LayerGraph.convertOutlineGraphToLayerMagic(
          outlineGraph,
          parsedLayer.ROut
        )

        // Convert to display format
        const steps: Array<CompositionStep> = layerMagicNodes.map((node, index) => {
          // Get a readable name for the layer expression
          const layerName = getExpressionName(tsRef, node.layerExpression)
          const operation: CompositionStep["operation"] = index === 0
            ? "provide" // First layer is the base
            : node.merges && node.provides
            ? "provideMerge"
            : node.merges
            ? "merge"
            : "provide"
          return { operation, layerName }
        })

        return steps.length > 1 ? steps : undefined
      }),
      Nano.orElse(() => Nano.succeed(undefined))
    )

    return { providersAndRequirers: displayInfo, suggestedComposition }
  })

/**
 * Gets a readable name from an expression (identifier, property access, or fallback to text)
 */
function getExpressionName(tsApi: TypeScriptApi.TypeScriptApi, expr: ts.Expression): string {
  if (tsApi.isIdentifier(expr)) {
    return tsApi.idText(expr)
  }
  if (tsApi.isPropertyAccessExpression(expr)) {
    return `${getExpressionName(tsApi, expr.expression)}.${tsApi.idText(expr.name)}`
  }
  if (tsApi.isCallExpression(expr)) {
    return getExpressionName(tsApi, expr.expression)
  }
  // Fallback: truncate the text representation
  const text = expr.getText().replace(/\s+/g, " ")
  return text.length > 30 ? text.slice(0, 27) + "..." : text
}

/**
 * Collects complete layer info for a named layer in a source file.
 * Returns only serializable data - no ts.Node or ts.Type references.
 * This is the main entry point for both CLI and testing.
 */
export const collectLayerInfoByName = (
  sourceFile: ts.SourceFile,
  layerName: string
): Nano.Nano<
  LayerInfoResult,
  LayerNotFoundError,
  | TypeScriptApi.TypeScriptApi
  | TypeCheckerApi.TypeCheckerApi
  | TypeParser.TypeParser
  | TypeCheckerUtils.TypeCheckerUtils
  | TypeScriptUtils.TypeScriptUtils
> =>
  Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    // Collect all layers with tsInfo (depth 0 = only directly exported)
    const { layers } = yield* collectExportedItems(sourceFile, ts, typeChecker, 0, true)

    // Find the layer by name
    const layer = layers.find((l) => l.name === layerName)
    if (!layer || !layer.tsInfo) {
      return yield* Nano.fail(new LayerNotFoundError(layerName, layers.map((l) => l.name)))
    }

    // Get the layer expression from the node
    const layerExpression = findLayerExpression(ts, layer.tsInfo.node)
    if (!layerExpression) {
      return { layer, providersAndRequirers: [], suggestedComposition: undefined }
    }

    // Collect details (providers, requirers, and suggested composition)
    const details = yield* pipe(
      collectLayerDetailsFromExpression(layerExpression),
      Nano.orElse(() => Nano.succeed<LayerDetails>({ providersAndRequirers: [], suggestedComposition: undefined }))
    )

    return { layer, ...details }
  })

/**
 * Finds the layer expression from a node (handles variable declarations, etc.)
 */
export function findLayerExpression(
  ts: TypeScriptApi.TypeScriptApi,
  node: ts.Node
): ts.Expression | undefined {
  // If it's already an expression, return it
  if (ts.isExpression(node)) {
    return node
  }

  // If it's an identifier, look up to its variable declaration
  if (ts.isIdentifier(node)) {
    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && parent.initializer) {
      return parent.initializer
    }
  }

  // Try to find the initializer in the parent hierarchy
  let current: ts.Node | undefined = node
  while (current) {
    if (ts.isVariableDeclaration(current) && current.initializer) {
      return current.initializer
    }
    current = current.parent
  }

  return undefined
}

export const layerInfo = Command.make(
  "layerinfo",
  {
    file: Options.file("file").pipe(
      Options.withDescription("The full path of the file containing the layer.")
    ),
    name: Options.text("name").pipe(
      Options.withDescription("The name of the exported layer to inspect.")
    )
  },
  Effect.fn("layerInfo")(function*({ file, name }) {
    const path = yield* Path.Path
    const cwd = path.resolve(".")
    const tsInstance = yield* TypeScriptContext
    const resolvedFile = path.resolve(file)

    const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

    service.openClientFile(resolvedFile)
    try {
      const scriptInfo = service.getScriptInfo(resolvedFile)
      if (!scriptInfo) {
        return yield* Effect.fail(new LayerNotFoundError(name, []))
      }

      const projectInfo = scriptInfo.getDefaultProject()
      const languageService = projectInfo.getLanguageService(true)
      const program = languageService.getProgram()
      if (!program) {
        return yield* Effect.fail(new LayerNotFoundError(name, []))
      }

      const sourceFile = program.getSourceFile(resolvedFile)
      if (!sourceFile) {
        return yield* Effect.fail(new LayerNotFoundError(name, []))
      }

      const typeChecker = program.getTypeChecker()

      const layerInfoResult = pipe(
        collectLayerInfoByName(sourceFile, name),
        TypeParser.nanoLayer,
        TypeCheckerUtils.nanoLayer,
        TypeScriptUtils.nanoLayer,
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
        Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
        Nano.run
      )

      if (Either.isLeft(layerInfoResult)) {
        return yield* Effect.fail(layerInfoResult.left)
      }

      const doc = renderLayerInfo(layerInfoResult.right, cwd)
      yield* Console.log(Doc.render(doc, { style: "pretty" }))
    } finally {
      service.closeClientFile(resolvedFile)
    }
  })
).pipe(
  Command.withDescription(
    "Shows detailed information about an exported layer in a file, as well as the suggested composition."
  )
)
