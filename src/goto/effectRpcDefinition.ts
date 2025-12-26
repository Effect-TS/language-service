import type * as ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export function effectRpcDefinition(
  applicableGotoDefinition: ts.DefinitionInfoAndBoundSpan | undefined,
  sourceFile: ts.SourceFile,
  position: number
): Nano.Nano<
  ts.DefinitionInfoAndBoundSpan | undefined,
  never,
  | TypeScriptApi.TypeScriptApi
  | TypeScriptUtils.TypeScriptUtils
  | TypeScriptApi.TypeScriptProgram
  | TypeCheckerApi.TypeCheckerApi
  | TypeCheckerUtils.TypeCheckerUtils
> {
  return Nano.gen(function*() {
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const textRange = tsUtils.toTextRange(position)

    function isSymbolFromEffectRpcModule(symbol: ts.Symbol) {
      if (symbol.valueDeclaration) {
        const sourceFile = tsUtils.getSourceFileOfNode(symbol.valueDeclaration)
        if (sourceFile) {
          const packageInfo = tsUtils.parsePackageContentNameAndVersionFromScope(sourceFile)
          if (packageInfo && packageInfo.name === "@effect/rpc") {
            const fileSymbol = typeChecker.getSymbolAtLocation(sourceFile)
            return fileSymbol && fileSymbol.exports && fileSymbol.exports.has("isRpc" as any) &&
              fileSymbol.exports.has("make" as any) &&
              fileSymbol.exports.has("fromTaggedRequest" as any)
          }
        }
      }
      return false
    }

    function isSymbolFromEffectRpcClientModule(symbol: ts.Symbol) {
      if (symbol.valueDeclaration) {
        const sourceFile = tsUtils.getSourceFileOfNode(symbol.valueDeclaration)
        if (sourceFile) {
          const packageInfo = tsUtils.parsePackageContentNameAndVersionFromScope(sourceFile)
          if (packageInfo && packageInfo.name === "@effect/rpc") {
            const fileSymbol = typeChecker.getSymbolAtLocation(sourceFile)
            return fileSymbol && fileSymbol.exports && fileSymbol.exports.has("RpcClient" as any) &&
              fileSymbol.exports.has("make" as any)
          }
        }
      }
      return false
    }

    // first find the rpc client method and object (if any)
    let rpcName: string | null = null
    let callNode: ts.Node | null = null
    for (const node of tsUtils.getAncestorNodesInRange(sourceFile, textRange)) {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.name) &&
        tsUtils.isNodeInRange(textRange)(node.name)
      ) {
        const type = typeCheckerUtils.getTypeAtLocation(node)
        if (!type) return undefined
        for (const callSig of typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
          // we detect if it is an RPC api based on where the options simbol is declared from
          if (callSig.parameters.length >= 2 && isSymbolFromEffectRpcClientModule(callSig.parameters[1])) {
            rpcName = ts.idText(node.name)
            callNode = node.name
          }
        }
      }
    }

    // no rpc found
    if (rpcName === null || callNode === null) return applicableGotoDefinition

    // collect involved nodes
    const result: Array<[ts.Node, ts.Symbol]> = []
    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    // loop through source files and keep only the ones referencing Rpc api
    const filesToTest: Array<ts.SourceFile> = []
    for (const programFile of program.getSourceFiles()) {
      if (programFile.isDeclarationFile) continue
      if (programFile.text.indexOf("make") === -1 && programFile.text.indexOf("fromTaggedRequest") === -1) continue
      // put first files that contains the name we are searching for (heuristic)
      if (programFile.text.indexOf(rpcName) > -1) {
        filesToTest.unshift(programFile)
      } else {
        filesToTest.push(programFile)
      }
    }

    for (const fileToTest of filesToTest) {
      // exit as soon we find a hit
      if (result.length > 0) break

      // start processing the file
      ts.forEachChild(fileToTest, appendNodeToVisit)

      while (result.length === 0 && nodeToVisit.length > 0) {
        const node = nodeToVisit.shift()!
        if (
          ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.name) &&
          (ts.idText(node.expression.name) === "make" || ts.idText(node.expression.name) === "fromTaggedRequest")
        ) {
          const symbol = typeChecker.getSymbolAtLocation(node.expression.name)
          if (symbol && isSymbolFromEffectRpcModule(symbol)) {
            const type = typeCheckerUtils.getTypeAtLocation(node)
            if (type) {
              const _tag = type.getProperty("_tag")
              if (_tag) {
                const tagValue = typeChecker.getTypeOfSymbolAtLocation(_tag, node)
                if ("value" in tagValue && tagValue.value === rpcName) result.push([node, symbol])
              }
            }
          }
        }

        ts.forEachChild(node, appendNodeToVisit)
      }
    }

    // nothing done
    if (result.length === 0) return applicableGotoDefinition

    // create the result entry for the definitions
    const effectRpcResult = result.map(([node]) => ({
      fileName: node.getSourceFile().fileName,
      textSpan: ts.createTextSpan(node.getStart(), node.end - node.getStart()),
      kind: ts.ScriptElementKind.constElement,
      name: rpcName,
      containerKind: ts.ScriptElementKind.constElement,
      containerName: rpcName
    }))

    if (applicableGotoDefinition) {
      return {
        ...applicableGotoDefinition,
        definitions: (applicableGotoDefinition.definitions || []).concat(effectRpcResult)
      } satisfies ts.DefinitionInfoAndBoundSpan
    }

    return ({
      textSpan: ts.createTextSpan(callNode.getStart(), callNode.end - callNode.getStart()),
      definitions: effectRpcResult
    })
  })
}
