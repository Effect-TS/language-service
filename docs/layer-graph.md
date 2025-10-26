# Layer Graph Internals

This document summarizes every moving part involved in parsing `Layer`s, keeping
track of their dependencies, and rendering the Mermaid graph that shows up in
QuickInfo. Start in `src/quickinfo/layerInfo.ts` – everything else is a helper
used by that entrypoint.

## Main entrypoint (`layerInfo`)

- `quickinfo.ts` wires the QuickInfo pipeline together and always calls
  `layerInfo(...)` last so any new documentation is appended.
- `layerInfo(...)` (`src/quickinfo/layerInfo.ts`) looks for a hovered variable
  or property declaration, resolves the initializer (or the declaration itself
  if it has no initializer), and asks the type checker for its type.
- The type is validated with `TypeParser.layerType(...)`. If it fails,
  QuickInfo is returned untouched. Otherwise a `LayerGraphContext` is created
  and `processLayerGraphNode(...)` is invoked on the expression tree.
- The function ultimately produces:
  - A Markdown block listing every provided (`ROut`) and required (`RIn`)
    service along with the innermost expression that produced it.
  - Optionally, a Mermaid link built by `generateMermaidUri(...)`.

## Parsing layers (`TypeParser.layerType`)

Located in `src/core/TypeParser.ts`.

1. `layerType(...)` ensures the type is "pipeable" (compatible with the helper’s
   expectations – see `pipeableType(...)` in the same file).
2. It enumerates the type’s property symbols (non-optional properties only),
   preferring ones named `LayerTypeId` so the hot path hits sooner.
3. Each property is inspected for a *layer variance struct*. That struct exposes
   `_ROut`, `_E`, `_RIn` accessors. `layerVarianceStruct(...)` extracts those
   three types via `varianceStructContravariantType` / `varianceStructCovariantType`.
4. The extracted `{ ROut, E, RIn }` tuple is cached per `ts.Type` so repeat
   checks are fast. `processLayerGraphNode(...)` consumes only `ROut` / `RIn`.

Other helpers from `TypeParser` that participate:

- `pipeCall(...)`: recognizes both `expr.pipe(...)` and `pipe(expr, ...)`
  shapes and returns `{ subject, args }`, so `processLayerGraphNode` can treat
  them uniformly.

## Building the layer graph (`processLayerGraphNode`)

Defined near the top of `src/quickinfo/layerInfo.ts`. It walks the AST and
builds a tree of `LayerGraphNode`s (either `GraphNodeLeaf` or
`GraphNodeCompoundTransform`).

Key behaviors:

1. **Pipe detection:** If the current node is a pipe call (detected via
   `TypeParser.pipeCall`), the subject is parsed first to obtain the left-most
   graph node, then every argument is parsed sequentially. Each call reuses
   the graph context so services remain deduplicated.
2. **Direct `Layer` calls:** When a call expression directly returns a Layer
   (`typeParser.layerType(typeOfCall)` succeeds), its arguments are parsed and
   attached as `args` to a new `GraphNodeCompoundTransform`.
3. **Pipe callbacks:** For expressions *inside* a pipe (`pipedInGraphNode` is
   defined) the code looks at the contextual type to see if it is a function
   from `Layer` to `Layer`. If so, it parses any arguments and wraps the
   previously piped node as the first argument of the transform.
4. **Leaf fallback:** Any expression whose *value* type is a `Layer` ends up as
   a `GraphNodeLeaf`.
5. **Failure mode:** If none of the above match, an
   `UnableToProduceLayerGraphError` is raised and QuickInfo will show
   `layer graph not created: ...`.

### Service bookkeeping

While building each node, the function calls
`TypeCheckerApi.appendToUniqueTypesMap(...)` for both `ROut` and `RIn`.

- The helper lives in `src/core/TypeCheckerApi.ts`.
- It keeps a `Map<string, ts.Type>` where each unique structural type gets a
  deterministic id (`t1`, `t2`, ...).
- When a union is encountered it is flattened so each concrete type is stored
  separately.
- Equivalence is checked by requiring mutual assignability
  (`isTypeAssignableTo(a, b)` and `isTypeAssignableTo(b, a)`).
- It returns `allIndexes`, which is exactly what every graph node stores in its
  `rout`/`rin` arrays. Those ids are the glue used by the Mermaid generator and
  the textual summary.

## Dependency summarization (`findInnermostGraphEdge`)

Before rendering docs, `layerInfo(...)` calls
`findInnermostGraphEdge(...)` for every `ROut`/`RIn` id hanging off the root.
This performs a depth-first search and returns the deepest graph nodes
contributing that requirement. The result is used to:

- Produce human-readable bullet lines such as
  `MyService provided at ln 12 col 4 by `Layer.succeed(...)``.
- Provide enough metadata (line/column + snippet) so users can jump straight to
  the relevant node.

## Mermaid rendering

All logic lives in `src/quickinfo/layerInfo.ts`.

1. `generateLayerMermaidUri(...)`
   seeds a `MermaidGraphContext` (`seenIds` ensures each node’s definition is
   emitted once) and delegates to `processNodeMermaid(...)`.
2. `processNodeMermaid(...)` recursively collects Mermaid snippets:
   - Each graph node becomes a `subgraph id ["`<node text>`"]` block annotated
     with source line/column.
   - Two nested subgraphs, `Requires` and `Provides`, are emitted and filled
     with one subgraph per service id. Service labels use
     `typeChecker.typeToString` with `NoTruncation` to keep the textual type.
   - For compound nodes, it renders edges:
     - `graph.id_rin_X -.-> child.id_rin_X` for shared requirements.
     - `graph.id_rout_X -.-> child.id_rout_X` for shared provisions.
     - `graph.id -.-x child.id` for children that do not share either, keeping
       the node visible in the flow.
3. The collected lines are joined with `flowchart TB\n`. The whole script is
   JSON-stringified, base64-encoded via `btoa`, and appended to
   `https://www.mermaidchart.com/play#`.

Because the output is only a URI, there is no local Mermaid runtime dependency.

## QuickInfo output

After graph construction succeeds:

1. The Markdown block is wrapped in triple backticks so VS Code renders it as a
   doc comment. Each line is prefixed with `*` to mimic JSDoc.
2. If a Mermaid URI exists, the code adds a QuickInfo link
   `{@link <uri> Show full Layer graph}`. VS Code turns this into a clickable
   entry.
3. When no prior QuickInfo existed, `layerInfo` synthesizes a minimal one so the
   documentation still shows up.

## Touchpoints & future work

- Editing how `Layer`s are parsed / grouped should happen in
  `processLayerGraphNode(...)`. The rest of the system (summaries, Mermaid,
  QuickInfo) operates on the abstract `LayerGraphNode` tree.
- To tweak the Mermaid output, `processNodeMermaid(...)` is the single place to
  adjust subgraph labels, edge styles, or the encoder.
- If different equivalence rules for services are needed, update
  `TypeCheckerApi.appendToUniqueTypesMap(...)` so that every consumer benefits.
- Additional tooling (diagnostics, quick fixes) can reuse the same service ids –
  the context is intentionally stored on `LayerGraphContext.services`.

## Playground & alternate views

- `buildLayerGraph(...)` is exported from `src/quickinfo/layerInfo.ts`, so any new
  renderer (Mermaid, tree view, etc.) can work off the shared `LayerGraphNode`
  tree without duplicating parser logic.
- `src/quickinfo/layerOutline.ts` exports `buildNamedLayerOutline(...)` and
  `renderNamedLayerOutline(...)`, which turn any `LayerGraphNode` tree into the
  high-level outline that ignores `Layer.merge/provide` scaffolding. The same
  module also exposes `generateNamedLayerOutlineMermaidUri(...)`, which renders
  that outline as a Mermaid flowchart and returns the `https://www.mermaidchart.com`
  link.
- Run `pnpm tsx scripts/layer-graph-playground.ts` to inspect a concrete example.
  The script loads `examples/quickinfo/layerGraphHierarchy.ts`, builds the graph
  for `AppLive`, prints the current node tree, lists the leaf nodes (named layers),
  and now also emits the *generated* outline that hides the provide/merge plumbing.
  Sample output:

  ```
  Generated Named Layer Outline:
  - AppService.Default
    - UserService.Default
      - UserRepository.Default
        - DatabaseLive
      - Analytics.Default
    - EventService.Default
      - EventsRepository.Default
        - DatabaseLive
      - Analytics.Default
  ```

  The script also prints the outline Mermaid link; QuickInfo now shows both the
  original “full” graph link and the outline link, so you can jump between the
  two visualizations quickly.

  Use that outline as the living spec while iterating on new renderers.
