import type { LayerGraphContext, LayerGraphNode } from "./layerInfo"

export interface NamedLayerOutlineNode {
  name: string
  children: Array<NamedLayerOutlineNode>
}

function findProviders(
  graph: LayerGraphNode,
  serviceId: string
): Array<LayerGraphNode> {
  if (graph.rout.includes(serviceId)) {
    if (graph._tag === "GraphNodeCompoundTransform") {
      let result: Array<LayerGraphNode> = []
      for (const child of graph.args) {
        result = result.concat(findProviders(child, serviceId))
      }
      if (result.length > 0) return result
    }
    return [graph]
  }
  if (graph._tag === "GraphNodeCompoundTransform") {
    return graph.args.flatMap((child) => findProviders(child, serviceId))
  }
  return []
}

function deriveLabel(providers: Array<LayerGraphNode>, fallback: string): string {
  for (const provider of providers) {
    const text = provider.node.getText().trim()
    const defaultMatch = text.match(/([A-Za-z0-9_$\.]+\.Default)/)
    if (defaultMatch) return defaultMatch[1]!
    const liveMatch = text.match(/([A-Z][A-Za-z0-9_$]*)/)
    if (liveMatch) return liveMatch[1]!
  }
  if (providers.length > 0) {
    const text = providers[0]!.node.getText().trim()
    return text.length > 80 ? text.slice(0, 77) + "..." : text
  }
  return fallback
}

interface ServiceInfo {
  label: string
  dependencies: Array<string>
}

function ensureServiceInfo(
  root: LayerGraphNode,
  memo: Map<string, ServiceInfo>,
  serviceId: string
) {
  if (memo.has(serviceId)) return
  const providers = findProviders(root, serviceId)
  const dependencies = new Set<string>()
  for (const provider of providers) {
    for (const dep of provider.rin) {
      dependencies.add(dep)
    }
  }
  const info: ServiceInfo = {
    label: deriveLabel(providers, serviceId),
    dependencies: Array.from(dependencies)
  }
  memo.set(serviceId, info)
  for (const dep of info.dependencies) {
    ensureServiceInfo(root, memo, dep)
  }
}

function buildServiceGraph(root: LayerGraphNode): Map<string, ServiceInfo> {
  const memo = new Map<string, ServiceInfo>()
  const visit = (serviceId: string) => ensureServiceInfo(root, memo, serviceId)
  for (const serviceId of root.rout) {
    visit(serviceId)
  }
  return memo
}

function mergeNodes(nodes: Array<NamedLayerOutlineNode>): Array<NamedLayerOutlineNode> {
  const map = new Map<string, NamedLayerOutlineNode>()
  for (const node of nodes) {
    const existing = map.get(node.name)
    if (existing) {
      existing.children = mergeNodes(existing.children.concat(node.children))
    } else {
      map.set(node.name, {
        name: node.name,
        children: mergeNodes(node.children)
      })
    }
  }
  return Array.from(map.values())
}

function buildNode(
  serviceId: string,
  infoMap: Map<string, ServiceInfo>,
  visited: Set<string>
): NamedLayerOutlineNode | undefined {
  if (visited.has(serviceId)) {
    return undefined
  }
  const info = infoMap.get(serviceId)
  if (!info) return undefined
  const nextVisited = new Set(visited)
  nextVisited.add(serviceId)
  const children = info.dependencies
    .map((dep) => buildNode(dep, infoMap, nextVisited))
    .filter((node): node is NamedLayerOutlineNode => Boolean(node))
  return {
    name: info.label,
    children: mergeNodes(children)
  }
}

function findTopLevelServices(
  root: LayerGraphNode,
  infoMap: Map<string, ServiceInfo>
): Array<string> {
  const topLevel = new Set(root.rout)
  const visit = (serviceId: string, ancestors: Set<string>) => {
    if (ancestors.has(serviceId)) return
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(serviceId)
    const info = infoMap.get(serviceId)
    if (!info) return
    for (const dep of info.dependencies) {
      topLevel.delete(dep)
      visit(dep, nextAncestors)
    }
  }
  for (const serviceId of root.rout) {
    visit(serviceId, new Set())
  }
  return Array.from(topLevel)
}

export function buildNamedLayerOutline(
  root: LayerGraphNode,
  _ctx: LayerGraphContext
): Array<NamedLayerOutlineNode> {
  const infoMap = buildServiceGraph(root)
  const topLevel = findTopLevelServices(root, infoMap)
  const nodes = topLevel
    .map((serviceId) => buildNode(serviceId, infoMap, new Set()))
    .filter((node): node is NamedLayerOutlineNode => Boolean(node))
  return mergeNodes(nodes)
}

function renderOutlineLines(
  nodes: Array<NamedLayerOutlineNode>,
  depth = 0,
  lines: Array<string> = []
): Array<string> {
  const prefix = "  ".repeat(depth)
  for (const node of nodes) {
    lines.push(`${prefix}- ${node.name}`)
    renderOutlineLines(node.children, depth + 1, lines)
  }
  return lines
}

export function renderNamedLayerOutline(
  nodes: Array<NamedLayerOutlineNode>
): string {
  return renderOutlineLines(nodes).join("\n")
}

function escapeMermaid(text: string) {
  return text.replace(/"/g, "#quot;")
}

export function generateNamedLayerOutlineMermaidUri(
  nodes: Array<NamedLayerOutlineNode>
): string | undefined {
  if (nodes.length === 0) return undefined
  let counter = 0
  const nodeIds = new Map<string, string>()
  const lines: Array<string> = []

  const getId = (name: string) => {
    let id = nodeIds.get(name)
    if (!id) {
      id = "n" + counter++
      nodeIds.set(name, id)
      lines.push(`${id}["${escapeMermaid(name)}"]`)
    }
    return id
  }

  function visit(node: NamedLayerOutlineNode) {
    const parentId = getId(node.name)
    for (const child of node.children) {
      const childId = getId(child.name)
      lines.push(`${parentId} --> ${childId}`)
      visit(child)
    }
  }

  for (const node of nodes) {
    visit(node)
  }

  const code = "flowchart TB\n" + lines.join("\n")
  const state = btoa(JSON.stringify({ code }))
  return "https://www.mermaidchart.com/play#" + state
}
