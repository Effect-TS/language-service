import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const leakingRequirements = LSP.createDiagnostic({
  name: "leakingRequirements",
  code: 8,
  description: "Detects implementation services leaked in service methods",
  group: "antipattern",
  severity: "suggestion",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("leakingRequirements.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const isExpectedLeakingServiceSuppressed = (leakedServiceName: string, startNode: ts.Node): boolean => {
      const sourceFile = tsUtils.getSourceFileOfNode(startNode)
      if (!sourceFile) return false

      return !!ts.findAncestor(startNode, (current) => {
        const ranges = ts.getLeadingCommentRanges(sourceFile.text, current.pos) ?? []
        const isSuppressed = ranges.some((range) => {
          const commentText = sourceFile.text.slice(range.pos, range.end)
          return commentText
            .split("\n")
            .filter((line) => line.includes("@effect-expect-leaking"))
            .some((line) => {
              const markerIndex = line.indexOf("@effect-expect-leaking")
              return markerIndex !== -1 &&
                line.slice(markerIndex + "@effect-expect-leaking".length).includes(leakedServiceName)
            })
        })

        if (isSuppressed) {
          return true
        }

        return (
            ts.isClassDeclaration(current) ||
            ts.isVariableStatement(current) ||
            ts.isExpressionStatement(current) ||
            ts.isStatement(current)
          )
          ? "quit"
          : false
      })
    }

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
                const servicePropertyCallSignatures = typeChecker.getSignaturesOfType(
                  servicePropertyType,
                  ts.SignatureKind.Call
                )
                if (servicePropertyCallSignatures.length === 1) {
                  return pipe(
                    typeParser.effectType(
                      typeChecker.getReturnTypeOfSignature(servicePropertyCallSignatures[0]),
                      atLocation
                    ),
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
              const { allIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                memory,
                effectContextType,
                (type) => {
                  // exclude never
                  if (type.flags & ts.TypeFlags.Never) return Nano.succeed(true)
                  // exclude scope
                  return pipe(
                    typeParser.scopeType(type, atLocation),
                    Nano.map(() => true),
                    Nano.orElse(() => Nano.succeed(false))
                  )
                }
              )
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
            return sharedRequirementsKeys.map((key) => memory.get(key)!).filter(
              (type) => {
                let symbol = type.symbol
                if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
                  symbol = typeChecker.getAliasedSymbol(symbol) || symbol
                }
                if (!symbol) return false
                return !(symbol?.declarations || []).some((declaration) => {
                  const declarationSource = tsUtils.getSourceFileOfNode(declaration)
                  if (!declarationSource) return false
                  return (declarationSource.text.substring(declaration.pos, declaration.end).toLowerCase().indexOf(
                    "@effect-leakable-service"
                  ) > -1)
                })
              }
            )
          }
          return []
        }
      ),
      "leakingServices.checkServiceLeaking",
      (_, service) => service
    )

    function reportLeakingRequirements(node: ts.Node, requirements: Array<ts.Type>) {
      const filteredRequirements = requirements.filter((requirement) =>
        !isExpectedLeakingServiceSuppressed(typeChecker.typeToString(requirement), node)
      )
      if (filteredRequirements.length === 0) return

      const requirementsStr = filteredRequirements.map((_) => typeChecker.typeToString(_)).join(" | ")
      const firstStr = typeChecker.typeToString(filteredRequirements[0])
      report({
        location: node,
        messageText: `Methods of this Service require \`${requirementsStr}\` from every caller.\n\n` +
          `The requirement becomes part of the public service surface instead of remaining internal to Layer implementation.\n\n` +
          `Resolve these dependencies at Layer creation and provide them to each method, so the service's type reflects its purpose, not its implementation.\n\n` +
          `To suppress this diagnostic for specific dependency types that are intentionally passed through (e.g., HttpServerRequest), add \`@effect-leakable-service\` JSDoc to their interface declarations (e.g., the \`${firstStr}\` interface), or to this service by adding a \`@effect-expect-leaking ${firstStr}\` JSDoc.\n\n` +
          `More info and examples at https://effect.website/docs/requirements-management/layers/#avoiding-requirement-leakage`,
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
        ts.isIdentifier(node.expression.name) && ts.idText(node.expression.name) === "GenericTag"
      ) {
        const nodeType = typeCheckerUtils.getTypeAtLocation(node)
        if (nodeType) typesToCheck.push([nodeType, node])
      } else if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) && ts.idText(node.expression.name) === "Service"
      ) {
        const nodeType = typeCheckerUtils.getTypeAtLocation(node)
        if (nodeType) typesToCheck.push([nodeType, node])
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
          Nano.orElse(() => typeParser.serviceType(type, node)),
          Nano.flatMap(({ Service }) =>
            pipe(
              parseLeakedRequirements(Service, node),
              Nano.map((requirements) =>
                reportLeakingRequirements(reportAt, Array.sort(requirements, typeCheckerUtils.deterministicTypeOrder))
              )
            )
          ),
          Nano.orElse(() => Nano.sync(() => ts.forEachChild(node, appendNodeToVisit))),
          Nano.ignore
        )
      }
    }
  })
})
