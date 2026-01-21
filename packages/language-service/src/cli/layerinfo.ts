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
import * as Option from "effect/Option"

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
 * An indexed output type for display and selection
 */
export interface IndexedOutputType {
  readonly index: number
  readonly typeString: string
  readonly included: boolean
}

/**
 * Result of layer-info command - contains only serializable data
 */
export interface LayerInfoResult {
  readonly layer: LayerInfo
  readonly providersAndRequirers: ReadonlyArray<LayerProviderRequirerDisplayInfo>
  readonly suggestedComposition: ReadonlyArray<CompositionStep> | undefined
  readonly outputTypes: ReadonlyArray<IndexedOutputType>
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

  // Suggested Composition section (includes tip, output types list, and composition)
  lines.push(Doc.empty)
  lines.push(Doc.annotate(Doc.text("Suggested Composition:"), Ansi.bold))

  // Tip about using Layer.mergeAll and --outputs
  lines.push(
    Doc.indent(
      dimLine("Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...)"),
      2
    )
  )
  lines.push(
    Doc.indent(
      dimLine(
        "then run this command again and use --outputs to select which outputs to include in composition."
      ),
      2
    )
  )
  lines.push(
    Doc.indent(
      dimLine("Example: --outputs 1,2,3"),
      2
    )
  )

  // Output types list with checkboxes
  if (result.outputTypes.length > 0) {
    lines.push(Doc.indent(dimLine(""), 2))
    for (const output of result.outputTypes) {
      const marker = output.included ? "[x]" : "[ ]"
      lines.push(Doc.indent(dimLine(`${marker} ${output.index}. ${output.typeString}`), 2))
    }
  }

  // Actual composition code
  if (result.suggestedComposition && result.suggestedComposition.length > 1) {
    lines.push(Doc.indent(dimLine(""), 2))
    const [first, ...rest] = result.suggestedComposition
    lines.push(Doc.indent(dimLine(`export const ${layer.name} = ${first!.layerName}.pipe(`), 2))
    for (let i = 0; i < rest.length; i++) {
      const step = rest[i]!
      const suffix = i === rest.length - 1 ? "" : ","
      lines.push(Doc.indent(dimLine(`Layer.${step.operation}(${step.layerName})${suffix}`), 4))
    }
    lines.push(Doc.indent(dimLine(")"), 2))
  }

  return Doc.vsep(lines)
}

/**
 * Details collected from a layer expression
 */
interface LayerDetails {
  readonly providersAndRequirers: ReadonlyArray<LayerProviderRequirerDisplayInfo>
  readonly suggestedComposition: ReadonlyArray<CompositionStep> | undefined
  readonly outputTypes: ReadonlyArray<IndexedOutputType>
}

/**
 * Collects detailed layer information from a layer expression node.
 * Returns only serializable data (strings, primitives) - no ts.Node or ts.Type references.
 * @param selectedOutputIndices - Optional array of 1-based indices to filter which outputs to include in composition.
 *                                If not provided or empty, all outputs are included.
 */
const collectLayerDetailsFromExpression = (
  layerExpression: ts.Expression,
  selectedOutputIndices: ReadonlyArray<number> | undefined
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
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

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

    // Extract layer graph with explodeOnlyLayerCalls for composition
    const compositionGraph = yield* LayerGraph.extractLayerGraph(layerExpression, {
      arrayLiteralAsMerge: true,
      explodeOnlyLayerCalls: true,
      followSymbolsDepth: 0
    })

    const outlineGraph = yield* LayerGraph.extractOutlineGraph(compositionGraph)

    // Collect all actualProvides from the outline graph (deduplicated and sorted)
    const allActualProvides = yield* LayerGraph.collectOutlineGraphActualProvides(outlineGraph)

    // Get the layer's ROut type to determine default selection
    const layerType = typeCheckerRef.getTypeAtLocation(layerExpression)
    const parsedLayer = yield* pipe(
      typeParser.layerType(layerType, layerExpression),
      Nano.orElse(() => Nano.succeed(undefined))
    )

    // Unroll the layer's ROut into individual types for default selection
    const layerROutTypes = parsedLayer
      ? typeCheckerUtils.unrollUnionMembers(parsedLayer.ROut).filter((_) => !(_.flags & tsRef.TypeFlags.Never))
      : []

    // Determine which indices are selected
    const hasSelection = selectedOutputIndices && selectedOutputIndices.length > 0
    const selectedSet = hasSelection ? new Set(selectedOutputIndices) : null

    // Create indexed output types for display
    // By default, only types that are in the layer's ROut are selected
    const outputTypes: Array<IndexedOutputType> = allActualProvides.map((type, idx) => {
      const index = idx + 1 // 1-based index
      const isInLayerROut = layerROutTypes.some((rOutType) =>
        typeCheckerRef.isTypeAssignableTo(type, rOutType) || typeCheckerRef.isTypeAssignableTo(rOutType, type)
      )
      return {
        index,
        typeString: typeCheckerRef.typeToString(type, undefined, tsRef.TypeFormatFlags.NoTruncation),
        included: selectedSet ? selectedSet.has(index) : isInLayerROut
      }
    })

    // Filter target outputs based on selection (or default to layer's ROut types)
    const targetOutputs = hasSelection
      ? allActualProvides.filter((_, idx) => selectedSet!.has(idx + 1))
      : allActualProvides.filter((type) =>
        layerROutTypes.some((rOutType) =>
          typeCheckerRef.isTypeAssignableTo(type, rOutType) || typeCheckerRef.isTypeAssignableTo(rOutType, type)
        )
      )

    // Try to compute suggested composition
    const suggestedComposition = yield* pipe(
      Nano.gen(function*() {
        if (targetOutputs.length === 0) {
          return undefined
        }

        const { layerMagicNodes } = yield* LayerGraph.convertOutlineGraphToLayerMagic(
          outlineGraph,
          targetOutputs
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

    return { providersAndRequirers: displayInfo, suggestedComposition, outputTypes }
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
 * @param selectedOutputIndices - Optional array of 1-based indices to filter which outputs to include in composition.
 *                                If not provided or empty, all outputs are included.
 */
export const collectLayerInfoByName = (
  sourceFile: ts.SourceFile,
  layerName: string,
  selectedOutputIndices?: ReadonlyArray<number>
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
      return { layer, providersAndRequirers: [], suggestedComposition: undefined, outputTypes: [] }
    }

    // Collect details (providers, requirers, and suggested composition)
    const details = yield* pipe(
      collectLayerDetailsFromExpression(layerExpression, selectedOutputIndices),
      Nano.orElse(() =>
        Nano.succeed<LayerDetails>({ providersAndRequirers: [], suggestedComposition: undefined, outputTypes: [] })
      )
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

/**
 * Parses a comma-separated list of output indices (e.g., "1,2,3") into an array of numbers.
 * Returns undefined if the input is empty or undefined.
 */
const parseOutputIndices = (outputs: Option.Option<string>): ReadonlyArray<number> | undefined => {
  if (Option.isNone(outputs)) return undefined
  const value = outputs.value.trim()
  if (value === "") return undefined
  return value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

export const layerInfo = Command.make(
  "layerinfo",
  {
    file: Options.file("file").pipe(
      Options.withDescription("The full path of the file containing the layer.")
    ),
    name: Options.text("name").pipe(
      Options.withDescription("The name of the exported layer to inspect.")
    ),
    outputs: Options.text("outputs").pipe(
      Options.withDescription(
        "Comma-separated list of output indices to include in suggested composition (e.g., 1,2,3). If not specified, all outputs are included."
      ),
      Options.optional
    )
  },
  Effect.fn("layerInfo")(function*({ file, name, outputs }) {
    const path = yield* Path.Path
    const cwd = path.resolve(".")
    const tsInstance = yield* TypeScriptContext
    const resolvedFile = path.resolve(file)

    // Parse the outputs option
    const selectedOutputIndices = parseOutputIndices(outputs)

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
        collectLayerInfoByName(sourceFile, name, selectedOutputIndices),
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
    "Shows detailed information about an exported layer in a file, showing dependencies as well helping you to get the right layer composition."
  )
)
