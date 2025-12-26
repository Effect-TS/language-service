import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missingEffectServiceDependency = LSP.createDiagnostic({
  name: "missingEffectServiceDependency",
  code: 22,
  description: "Checks that Effect.Service dependencies satisfy all required layer inputs",
  severity: "off",
  apply: Nano.fn("missingEffectServiceDependency.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a class declaration that extends Effect.Service
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        const serviceResult = yield* pipe(
          typeParser.extendsEffectService(node),
          Nano.orElse(() => Nano.void_)
        )

        if (serviceResult) {
          const { className, options } = serviceResult

          // Get the class symbol and its type
          const classSymbol = typeChecker.getSymbolAtLocation(className)
          if (classSymbol) {
            const classType = typeChecker.getTypeOfSymbol(classSymbol)

            // Try to get DefaultWithoutDependencies first, then Default
            const defaultWithoutDepsProperty = typeChecker.getPropertyOfType(classType, "DefaultWithoutDependencies")
            const defaultProperty = defaultWithoutDepsProperty || typeChecker.getPropertyOfType(classType, "Default")

            if (defaultProperty) {
              const defaultType = typeChecker.getTypeOfSymbolAtLocation(defaultProperty, node)

              // Parse the layer type to get RIN
              const layerResult = yield* pipe(
                typeParser.layerType(defaultType, node),
                Nano.orElse(() => Nano.void_)
              )

              if (layerResult) {
                // Use a single memory map for both required and provided services
                const servicesMemory = new Map<string, ts.Type>()
                const excludeNever = (type: ts.Type) => Nano.succeed((type.flags & ts.TypeFlags.Never) !== 0)

                // Get all required service indexes
                const { allIndexes: requiredIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                  servicesMemory,
                  layerResult.RIn,
                  excludeNever
                )

                // Process dependencies (treat undefined/null as empty array)
                const providedIndexes = new Set<string>()

                let types: Array<ts.Type> = []

                const optionsType = typeCheckerUtils.getTypeAtLocation(options)
                if (optionsType) {
                  const dependenciesProperty = typeChecker.getPropertyOfType(optionsType, "dependencies")
                  if (dependenciesProperty) {
                    const dependenciesTypes = typeChecker.getTypeOfSymbolAtLocation(dependenciesProperty, options)
                    const numberIndexType = typeChecker.getIndexTypeOfType(dependenciesTypes, ts.IndexKind.Number)
                    types = numberIndexType ? typeCheckerUtils.unrollUnionMembers(numberIndexType) : []
                  }
                }

                // Process each dependency to get what services they provide
                for (const depType of types) {
                  // Try to parse as layer type
                  const depLayerResult = yield* pipe(
                    typeParser.layerType(depType, options),
                    Nano.orElse(() => Nano.void_)
                  )

                  if (depLayerResult) {
                    // Add the ROut of this dependency to the same memory map
                    const { allIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                      servicesMemory,
                      depLayerResult.ROut,
                      excludeNever
                    )
                    // Collect all provided indexes
                    for (const index of allIndexes) {
                      providedIndexes.add(index)
                    }
                  }
                }

                // Find missing services: required indexes not in provided indexes
                const missingIndexes = requiredIndexes.filter((index) => !providedIndexes.has(index))

                // Report diagnostic if there are missing dependencies
                if (missingIndexes.length > 0) {
                  const missingTypes = missingIndexes.map((index) => servicesMemory.get(index)!)
                  const missingTypeNames = missingTypes.map((t) => typeChecker.typeToString(t))

                  const message = missingTypeNames.length === 1
                    ? `Service '${missingTypeNames[0]}' is required but not provided by dependencies`
                    : `Services ${
                      missingTypeNames.map((s) => `'${s}'`).join(", ")
                    } are required but not provided by dependencies`

                  report({
                    location: className,
                    messageText: message,
                    fixes: []
                  })
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
