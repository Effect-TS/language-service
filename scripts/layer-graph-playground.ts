import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import * as Nano from "../src/core/Nano.js"
import * as TypeCheckerApi from "../src/core/TypeCheckerApi.js"
import * as TypeParser from "../src/core/TypeParser.js"
import * as TypeScriptApi from "../src/core/TypeScriptApi.js"
import {
  buildLayerGraph,
  generateLayerMermaidUri,
  type LayerGraphNode
} from "../src/quickinfo/layerInfo.js"
import {
  buildNamedLayerOutline,
  generateNamedLayerOutlineMermaidUri,
  renderNamedLayerOutline
} from "../src/quickinfo/layerOutline.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const exampleFile = resolve(projectRoot, "examples/quickinfo/layerGraphHierarchy.ts")

const program = ts.createProgram([exampleFile], {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  esModuleInterop: true,
  skipLibCheck: true
})

const sourceFile = program.getSourceFile(exampleFile)
if (!sourceFile) {
  throw new Error("Unable to load example source file")
}

const typeChecker = program.getTypeChecker()

function findLayerInitializer(name: string): ts.Expression {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
        return declaration.initializer
      }
    }
  }
  throw new Error("Unable to find declaration for " + name)
}

const layerNode = findLayerInitializer("AppLive")

const graphResult = pipe(
  buildLayerGraph(layerNode),
  Nano.provideService(TypeParser.TypeParser, TypeParser.make(ts, typeChecker)),
  Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
  Nano.provideService(TypeCheckerApi.TypeCheckerApiCache, TypeCheckerApi.makeTypeCheckerApiCache()),
  Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
  Nano.run
)

if (Either.isLeft(graphResult)) {
  throw new Error("Unable to build layer graph: " + graphResult.left.message)
}

const { rootNode, context: graphCtx } = graphResult.right

function formatNodeLabel(node: LayerGraphNode): string {
  const text = node.node.getText().replace(/\s+/g, " ").trim()
  return text.length > 80 ? text.slice(0, 77) + "..." : text
}

function renderGraphTree(node: LayerGraphNode, depth = 0, lines: Array<string> = []): Array<string> {
  const prefix = "  ".repeat(depth)
  lines.push(`${prefix}- ${formatNodeLabel(node)} (${node._tag === "GraphNodeLeaf" ? "leaf" : "compound"})`)
  if (node._tag === "GraphNodeCompoundTransform") {
    for (const child of node.args) {
      renderGraphTree(child, depth + 1, lines)
    }
  }
  return lines
}

type LeafPath = {
  path: Array<string>
  leaf: string
}

function collectLeafPaths(
  node: LayerGraphNode,
  ancestors: Array<string> = []
): Array<LeafPath> {
  const current = [...ancestors, formatNodeLabel(node)]
  if (node._tag === "GraphNodeLeaf") {
    return [{ path: ancestors, leaf: formatNodeLabel(node) }]
  }
  return node.args.flatMap((child) => collectLeafPaths(child, current))
}

function renderLeafPaths(paths: Array<LeafPath>): Array<string> {
  return paths.map((entry) => {
    if (entry.path.length === 0) return `- ${entry.leaf}`
    return `- ${entry.leaf} (via ${entry.path.join(" -> ")})`
  })
}

console.log("Current Graph Tree:")
console.log(renderGraphTree(rootNode).join("\n"))
console.log("\nNamed Layer Leaves:")
console.log(renderLeafPaths(collectLeafPaths(rootNode)).join("\n"))

const outline = buildNamedLayerOutline(rootNode, graphCtx)
console.log("\nGenerated Named Layer Outline:")
console.log(renderNamedLayerOutline(outline))
const outlineMermaidLink = generateNamedLayerOutlineMermaidUri(outline)
if (outlineMermaidLink) {
  console.log("\nOutline Mermaid Link:")
  console.log(outlineMermaidLink)
}

const fullMermaidLink = pipe(
  generateLayerMermaidUri(rootNode, graphCtx),
  Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
  Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
  Nano.run
)

if (Either.isRight(fullMermaidLink)) {
  console.log("\nFull Layer Mermaid Link:")
  console.log(fullMermaidLink.right)
}
