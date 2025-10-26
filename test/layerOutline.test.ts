import { buildLayerGraph } from "@effect/language-service/quickinfo/layerInfo"
import {
  buildNamedLayerOutline,
  renderNamedLayerOutline
} from "@effect/language-service/quickinfo/layerOutline"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"

const exampleFile = path.join(__dirname, "..", "examples", "quickinfo", "layerGraphHierarchy.ts")

function findLayerInitializer(sourceFile: ts.SourceFile, name: string): ts.Expression {
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

describe("layer outline", () => {
  it("renders named outline for AppLive", () => {
    const program = ts.createProgram([exampleFile], {
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
      skipLibCheck: true
    })
    const sourceFile = program.getSourceFile(exampleFile)
    expect(sourceFile).toBeDefined()
    const typeChecker = program.getTypeChecker()
    const layerNode = findLayerInitializer(sourceFile!, "AppLive")

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

    const outlineNodes = buildNamedLayerOutline(graphResult.right.rootNode, graphResult.right.context)
    expect(renderNamedLayerOutline(outlineNodes)).toMatchInlineSnapshot(`
- AppService.Default
  - UserService.Default
    - UserRepository.Default
      - DatabaseLive
    - Analytics.Default
  - EventService.Default
    - EventsRepository.Default
      - DatabaseLive
    - Analytics.Default
`)
  })
})
