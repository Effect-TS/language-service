import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const leakingRequirements = LSP.createDiagnostic({
  name: "leakingRequirements",
  code: 8,
  apply: Nano.fn("leakingRequirements.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeOrder = yield* TypeCheckerApi.deterministicTypeOrder

    const parseLeakedRequirements = Nano.cachedBy(
      Nano.fn("leakingServices.checkServiceLeaking")(
        function*(service: ts.Type, atLocation: ts.Node) {
          const properties = typeChecker.getPropertiesOfType(service)
          // since this is an heuristic, we require at least 2 props
          if (properties.length < 1) return []
          // store the accumulated services
          const memory = new Map<string, ts.Type>()
          let sharedRequirementsKeys: Array<string> | undefined = undefined
          let effectMembers = 0
          for (const property of properties) {
            // get the context type of the property, either Effect<...> or () => Effect<...>
            const servicePropertyType = typeChecker.getTypeOfSymbolAtLocation(property, atLocation)
            let effectContextType: ts.Type | undefined = undefined
            yield* pipe(
              typeParser.effectType(servicePropertyType, atLocation),
              Nano.map((_) => effectContextType = _.R),
              Nano.orElse(() => {
                const servicePropertyCallSignatures = servicePropertyType.getCallSignatures()
                if (servicePropertyCallSignatures.length === 1) {
                  return pipe(
                    typeParser.effectType(servicePropertyCallSignatures[0].getReturnType(), atLocation),
                    Nano.map((_) => {
                      effectContextType = _.R
                    })
                  )
                }
                return Nano.void_
              }),
              Nano.ignore
            )
            // once we have the type, check the context for shared requirements
            if (effectContextType) {
              effectMembers++
              const { allIndexes } = yield* TypeCheckerApi.appendToUniqueTypesMap(memory, effectContextType, true)
              if (!sharedRequirementsKeys) {
                sharedRequirementsKeys = allIndexes
              } else {
                sharedRequirementsKeys = Array.intersection(sharedRequirementsKeys, allIndexes)
                if (sharedRequirementsKeys.length === 0) return []
              }
            }
          }
          // ...and those at least 2 props must be or return effects
          if (sharedRequirementsKeys && sharedRequirementsKeys.length > 0 && effectMembers >= 2) {
            return sharedRequirementsKeys.map((key) => memory.get(key)!)
          }
          return []
        }
      ),
      "leakingServices.checkServiceLeaking",
      (_, service) => service
    )

    function reportLeakingRequirements(node: ts.Node, requirements: Array<ts.Type>) {
      if (requirements.length === 0) return
      report({
        node,
        category: ts.DiagnosticCategory.Warning,
        messageText: `This Service is leaking the ${
          requirements.map((_) => typeChecker.typeToString(_)).join(" | ")
        } requirement.\nIf these requirements cannot be cached and are expected to be provided per method invocation (e.g. HttpServerRequest), you can safely disable this diagnostic for this line through quickfixes.\nMore info at https://effect.website/docs/requirements-management/layers/#avoiding-requirement-leakage`,
        fixes: []
      })
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // we need to check the type of the class declaration (if any)
      const typesToCheck: Array<[type: ts.Type, reportNode: ts.Node]> = []
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) && node.expression.name.text === "GenericTag"
      ) {
        typesToCheck.push([typeChecker.getTypeAtLocation(node), node])
      } else if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        const classSym = typeChecker.getSymbolAtLocation(node.name)
        if (classSym) {
          const type = typeChecker.getTypeOfSymbol(classSym)
          typesToCheck.push([type, node.name])
        }
      } else {
        ts.forEachChild(node, appendNodeToVisit)
        continue
      }

      // check the types
      for (const [type, reportAt] of typesToCheck) {
        yield* pipe(
          typeParser.contextTag(type, node),
          Nano.flatMap(({ Service }) =>
            pipe(
              parseLeakedRequirements(Service, node),
              Nano.map((requirements) => reportLeakingRequirements(reportAt, Array.sort(requirements, typeOrder)))
            )
          ),
          Nano.orElse(() => Nano.sync(() => ts.forEachChild(node, appendNodeToVisit))),
          Nano.ignore
        )
      }
    }
  })
})
