import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import { type TypeScriptApi, TypeScriptContext } from "../utils"
import type { Assessment } from "./assessment"
import type { Target } from "./target"

/**
 * Represents a text change to be applied to a file
 */
export interface FileChange {
  readonly filePath: string
  readonly sourceFile: ts.JsonSourceFile
  readonly textChanges: ReadonlyArray<ts.TextChange>
  readonly description: string // Human-readable description of what this change does
}

/**
 * Compute the set of changes needed to go from assessment state to target state
 */
export const computeChanges = (
  assessment: Assessment.State,
  target: Target.State
): Effect.Effect<ReadonlyArray<FileChange>, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const changes: Array<FileChange> = []

    // Compute package.json changes (always present)
    const packageJsonChanges = yield* computePackageJsonChanges(
      assessment.packageJson,
      target.packageJson
    )
    if (packageJsonChanges.textChanges.length > 0) {
      changes.push(packageJsonChanges)
    }

    // Compute tsconfig changes (always present)
    const tsconfigChanges = yield* computeTsConfigChanges(
      assessment.tsconfig,
      target.tsconfig,
      target.packageJson.lspDependencyType
    )
    if (tsconfigChanges.textChanges.length > 0) {
      changes.push(tsconfigChanges)
    }

    // Compute VSCode settings changes (optional)
    if (Option.isSome(target.vscodeSettings) && Option.isSome(assessment.vscodeSettings)) {
      const vscodeChanges = yield* computeVSCodeSettingsChanges(
        assessment.vscodeSettings.value,
        target.vscodeSettings.value
      )
      if (vscodeChanges.textChanges.length > 0) {
        changes.push(vscodeChanges)
      }
    }

    return changes
  })
}

/**
 * Find a property in an object literal expression by name
 */
function findPropertyInObject(
  tsInstance: TypeScriptApi,
  obj: ts.ObjectLiteralExpression,
  propertyName: string
): ts.PropertyAssignment | undefined {
  for (const prop of obj.properties) {
    if (tsInstance.isPropertyAssignment(prop)) {
      const propAssignment = prop as ts.PropertyAssignment
      const name = propAssignment.name
      if (tsInstance.isIdentifier(name) && tsInstance.idText(name) === propertyName) {
        return propAssignment
      }
      if (tsInstance.isStringLiteral(name) && (name as ts.StringLiteral).text === propertyName) {
        return propAssignment
      }
    }
  }
  return undefined
}

/**
 * Get the root object literal from a JSON source file
 */
function getRootObject(
  tsInstance: TypeScriptApi,
  sourceFile: ts.JsonSourceFile
): ts.ObjectLiteralExpression | undefined {
  if (sourceFile.statements.length === 0) return undefined
  const statement = sourceFile.statements[0]
  if (!tsInstance.isExpressionStatement(statement)) return undefined
  const expr = statement.expression
  if (!tsInstance.isObjectLiteralExpression(expr)) return undefined
  return expr as ts.ObjectLiteralExpression
}

/**
 * Delete a property from an object literal, handling commas properly
 */
function deletePropertyWithComma(
  tracker: any,
  sourceFile: ts.SourceFile,
  property: ts.PropertyAssignment,
  parent: ts.ObjectLiteralExpression
) {
  const propertyIndex = parent.properties.indexOf(property)
  const isLast = propertyIndex === parent.properties.length - 1
  const isFirst = propertyIndex === 0

  // If it's not the last property, include the trailing comma in deletion
  if (!isLast) {
    const nextProperty = parent.properties[propertyIndex + 1]
    const start = property.getFullStart()
    const end = nextProperty.getFullStart()
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else if (!isFirst) {
    // If it's the last property but not the first, include the leading comma
    const prevProperty = parent.properties[propertyIndex - 1]
    const start = prevProperty.getEnd()
    const end = property.getEnd()
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else {
    // It's the only property, just delete it
    tracker.delete(sourceFile, property)
  }
}

/**
 * Delete an element from an array literal, handling commas properly
 */
function deleteElementWithComma(
  tracker: any,
  sourceFile: ts.SourceFile,
  element: ts.Expression,
  parent: ts.ArrayLiteralExpression
) {
  const elementIndex = parent.elements.indexOf(element)
  const isLast = elementIndex === parent.elements.length - 1
  const isFirst = elementIndex === 0

  // If it's not the last element, include the trailing comma in deletion
  if (!isLast) {
    const nextElement = parent.elements[elementIndex + 1]
    const start = element.getFullStart()
    const end = nextElement.getFullStart()
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else if (!isFirst) {
    // If it's the last element but not the first, include the leading comma
    const prevElement = parent.elements[elementIndex - 1]
    const start = prevElement.getEnd()
    const end = element.getEnd()
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else {
    // It's the only element, just delete it
    tracker.delete(sourceFile, element)
  }
}

/**
 * Create a minimal LanguageServiceHost for use with ChangeTracker
 */
function createMinimalHost(_ts: TypeScriptApi): ts.LanguageServiceHost {
  return {
    getCompilationSettings: () => ({}),
    getScriptFileNames: () => [],
    getScriptVersion: () => "1",
    getScriptSnapshot: () => undefined,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "lib.d.ts",
    fileExists: () => false,
    readFile: () => undefined
  }
}

/**
 * Compute package.json changes using ChangeTracker
 */
const computePackageJsonChanges = (
  current: Assessment.PackageJson,
  target: Target.PackageJson
): Effect.Effect<FileChange, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const ts = yield* TypeScriptContext
    const descriptions: Array<string> = []

    const rootObj = getRootObject(ts, current.sourceFile)
    if (!rootObj) {
      return {
        filePath: current.path,
        sourceFile: current.sourceFile,
        textChanges: [],
        description: "Unable to parse package.json structure"
      }
    }

    // Use ChangeTracker API
    const host = createMinimalHost(ts)
    const formatOptions = { indentSize: 2, tabSize: 2 } as ts.EditorSettings
    const formatContext = (ts as any).formatting.getFormatContext(formatOptions, { newLine: "\n" })
    const preferences = {} as ts.UserPreferences
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

    const fileChanges = (ts as any).textChanges.ChangeTracker.with(
      { host, formatContext, preferences },
      (tracker: any) => {
        // Track which nodes have already had commas added after them
        const nodesWithCommasAdded = new Set<ts.Node>()
        const insertPropertyAfterWithCommaOnce = (
          previousProperty: ts.ObjectLiteralElementLike,
          newProperty: ts.ObjectLiteralElementLike
        ) => {
          // Manually insert comma + newline + property text
          const newPropertyText = printer.printNode(ts.EmitHint.Unspecified, newProperty, current.sourceFile)
          const insertPos = previousProperty.getEnd()

          if (!nodesWithCommasAdded.has(previousProperty)) {
            tracker.insertText(current.sourceFile, insertPos, `,\n${newPropertyText}`)
            nodesWithCommasAdded.add(previousProperty)
          } else {
            tracker.insertText(current.sourceFile, insertPos, `\n${newPropertyText}`)
          }
        }

        // Handle @effect/language-service dependency
        if (Option.isSome(target.lspDependencyType)) {
          // User wants to install LSP
          const dependencyField = target.lspDependencyType.value
          descriptions.push(`Add @effect/language-service to ${dependencyField}`)

          const depsProperty = findPropertyInObject(ts, rootObj, dependencyField)

          if (!depsProperty) {
            // Need to add entire dependencies section
            const newDepsProp = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(dependencyField),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral("@effect/language-service"),
                  ts.factory.createStringLiteral("workspace:*")
                )
              ], false)
            )

            // Insert after the last property
            const lastProp = rootObj.properties[rootObj.properties.length - 1]
            if (lastProp) {
              insertPropertyAfterWithCommaOnce(lastProp, newDepsProp)
            }
          } else if (ts.isObjectLiteralExpression(depsProperty.initializer)) {
            // dependencies/devDependencies exists, check if @effect/language-service is already there
            const lspProperty = findPropertyInObject(ts, depsProperty.initializer, "@effect/language-service")

            if (!lspProperty) {
              // Add to existing dependencies
              const newLspProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral("@effect/language-service"),
                ts.factory.createStringLiteral("workspace:*")
              )

              const depsObj = depsProperty.initializer
              if (depsObj.properties.length > 0) {
                const lastProp = depsObj.properties[depsObj.properties.length - 1]
                // Manually insert with comma
                const newLspPropText = printer.printNode(ts.EmitHint.Unspecified, newLspProp, current.sourceFile)
                tracker.insertText(current.sourceFile, lastProp.getEnd(), `,\n${newLspPropText}`)
              } else {
                // Empty dependencies object - insert at beginning
                tracker.insertNodeAt(
                  current.sourceFile,
                  depsObj.getStart(current.sourceFile) + 1,
                  newLspProp
                )
              }
            }
          }
        } else if (Option.isSome(current.lspVersion)) {
          // User wants to remove LSP and it's currently installed
          descriptions.push("Remove @effect/language-service from dependencies")

          // Find and remove from devDependencies or dependencies
          const currentDepType = current.lspVersion.value.dependencyType
          const depsProperty = findPropertyInObject(ts, rootObj, currentDepType)

          if (depsProperty && ts.isObjectLiteralExpression(depsProperty.initializer)) {
            const lspProperty = findPropertyInObject(ts, depsProperty.initializer, "@effect/language-service")
            if (lspProperty) {
              deletePropertyWithComma(tracker, current.sourceFile, lspProperty, depsProperty.initializer)
            }
          }
        }

        // Handle prepare script
        if (target.prepareScript && Option.isSome(target.lspDependencyType)) {
          // User wants LSP and prepare script
          const scriptsProperty = findPropertyInObject(ts, rootObj, "scripts")

          if (!scriptsProperty) {
            // Need to add entire scripts section
            descriptions.push("Add scripts section with prepare script")

            const newScriptsProp = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral("scripts"),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral("prepare"),
                  ts.factory.createStringLiteral("effect-language-service patch")
                )
              ], false)
            )

            const lastProp = rootObj.properties[rootObj.properties.length - 1]
            if (lastProp) {
              // Always insert scripts with comma manually (it might be after devDependencies which was just added)
              const newScriptsPropText = printer.printNode(ts.EmitHint.Unspecified, newScriptsProp, current.sourceFile)
              tracker.insertText(current.sourceFile, lastProp.getEnd(), `,\n${newScriptsPropText}`)
            }
          } else if (ts.isObjectLiteralExpression(scriptsProperty.initializer)) {
            // scripts exists, check if prepare script exists
            const prepareProperty = findPropertyInObject(ts, scriptsProperty.initializer, "prepare")

            if (!prepareProperty) {
              // Add prepare script
              descriptions.push("Add prepare script")

              const newPrepareProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral("prepare"),
                ts.factory.createStringLiteral("effect-language-service patch")
              )

              const scriptsObj = scriptsProperty.initializer
              if (scriptsObj.properties.length > 0) {
                const lastProp = scriptsObj.properties[scriptsObj.properties.length - 1]
                // Manually insert with comma
                const newPreparePropText = printer.printNode(
                  ts.EmitHint.Unspecified,
                  newPrepareProp,
                  current.sourceFile
                )
                tracker.insertText(current.sourceFile, lastProp.getEnd(), `,\n${newPreparePropText}`)
              } else {
                tracker.insertNodeAt(
                  current.sourceFile,
                  scriptsObj.getStart(current.sourceFile) + 1,
                  newPrepareProp
                )
              }
            } else if (Option.isSome(current.prepareScript) && !current.prepareScript.value.hasPatch) {
              // Modify existing prepare script to add patch command
              descriptions.push("Update prepare script to include patch command")

              const currentScript = current.prepareScript.value.script
              const newScript = `${currentScript} && effect-language-service patch`

              const newPrepareProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral("prepare"),
                ts.factory.createStringLiteral(newScript)
              )

              tracker.replaceNode(current.sourceFile, prepareProperty, newPrepareProp)
            }
          }
        } else if (
          Option.isNone(target.lspDependencyType) && Option.isSome(current.prepareScript) &&
          current.prepareScript.value.hasPatch
        ) {
          // User wants to remove LSP and prepare script has patch command
          descriptions.push("Remove prepare script with patch command")

          const scriptsProperty = findPropertyInObject(ts, rootObj, "scripts")
          if (scriptsProperty && ts.isObjectLiteralExpression(scriptsProperty.initializer)) {
            const prepareProperty = findPropertyInObject(ts, scriptsProperty.initializer, "prepare")
            if (prepareProperty) {
              deletePropertyWithComma(tracker, current.sourceFile, prepareProperty, scriptsProperty.initializer)
            }
          }
        }
      }
    )

    // Extract text changes for this file
    const fileChange = fileChanges.find((fc: ts.FileTextChanges) => fc.fileName === current.path)
    const changes = fileChange ? fileChange.textChanges : []

    return {
      filePath: current.path,
      sourceFile: current.sourceFile,
      textChanges: changes,
      description: descriptions.join("; ")
    }
  })
}

/**
 * Compute tsconfig.json changes using ChangeTracker
 */
const computeTsConfigChanges = (
  current: Assessment.TsConfig,
  target: Target.TsConfig,
  lspDependencyType: Option.Option<"devDependencies" | "dependencies">
): Effect.Effect<FileChange, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const ts = yield* TypeScriptContext
    const descriptions: Array<string> = []

    const rootObj = getRootObject(ts, current.sourceFile)
    if (!rootObj) {
      return {
        filePath: current.path,
        sourceFile: current.sourceFile,
        textChanges: [],
        description: "Unable to parse tsconfig.json structure"
      }
    }

    // Find or create compilerOptions
    const compilerOptionsProperty = findPropertyInObject(ts, rootObj, "compilerOptions")
    if (!compilerOptionsProperty) {
      return {
        filePath: current.path,
        sourceFile: current.sourceFile,
        textChanges: [],
        description: "No compilerOptions found in tsconfig.json"
      }
    }

    if (!ts.isObjectLiteralExpression(compilerOptionsProperty.initializer)) {
      return {
        filePath: current.path,
        sourceFile: current.sourceFile,
        textChanges: [],
        description: "compilerOptions is not an object"
      }
    }

    const compilerOptions = compilerOptionsProperty.initializer

    // Use ChangeTracker API
    const textChanges = (ts as any).textChanges
    const host = createMinimalHost(ts)
    const formatOptions = { indentSize: 2, tabSize: 2 } as ts.EditorSettings
    const formatContext = (ts as any).formatting.getFormatContext(formatOptions, { newLine: "\n" })
    const preferences = {} as ts.UserPreferences
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

    const fileChanges = textChanges.ChangeTracker.with(
      { host, formatContext, preferences },
      (tracker: any) => {
        const pluginsProperty = findPropertyInObject(ts, compilerOptions, "plugins")

        // Check if we should remove the plugin (user doesn't want LSP installed)
        if (Option.isNone(lspDependencyType)) {
          // User wants to remove LSP
          if (pluginsProperty && ts.isArrayLiteralExpression(pluginsProperty.initializer)) {
            const pluginsArray = pluginsProperty.initializer

            // Find the @effect/language-service plugin
            const lspPluginElement = pluginsArray.elements.find((element) => {
              if (ts.isObjectLiteralExpression(element)) {
                const nameProperty = findPropertyInObject(ts, element, "name")
                if (nameProperty && ts.isStringLiteral(nameProperty.initializer)) {
                  return (nameProperty.initializer as ts.StringLiteral).text === "@effect/language-service"
                }
              }
              return false
            })

            if (lspPluginElement) {
              descriptions.push("Remove @effect/language-service plugin from tsconfig")
              deleteElementWithComma(tracker, current.sourceFile, lspPluginElement, pluginsArray)
            }
          }
        } else {
          // User wants to add/keep LSP
          const buildPluginObject = (severities: Option.Option<Record<string, string>>) => {
            const nameProperty = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral("name"),
              ts.factory.createStringLiteral("@effect/language-service")
            )

            return Option.match(severities, {
              onNone: () => {
                // Just the name property
                return ts.factory.createObjectLiteralExpression([nameProperty], false)
              },
              onSome: (sevs) => {
                // Name + diagnosticSeverity
                const severityProperties = Object.entries(sevs).map(([name, severity]) =>
                  ts.factory.createPropertyAssignment(
                    ts.factory.createStringLiteral(name),
                    ts.factory.createStringLiteral(severity)
                  )
                )

                const diagnosticSeverityProperty = ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral("diagnosticSeverity"),
                  ts.factory.createObjectLiteralExpression(severityProperties, true)
                )

                return ts.factory.createObjectLiteralExpression(
                  [nameProperty, diagnosticSeverityProperty],
                  true
                )
              }
            })
          }

          const pluginObject = buildPluginObject(target.diagnosticSeverities)

          if (!pluginsProperty) {
            // Add entire plugins array with LSP plugin
            descriptions.push("Add plugins array with @effect/language-service plugin")

            const newPluginsProp = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral("plugins"),
              ts.factory.createArrayLiteralExpression([pluginObject], true)
            )

            const lastProp = compilerOptions.properties[compilerOptions.properties.length - 1]
            if (lastProp) {
              // Manually insert with comma
              const newPluginsPropText = printer.printNode(ts.EmitHint.Unspecified, newPluginsProp, current.sourceFile)
              tracker.insertText(current.sourceFile, lastProp.getEnd(), `,\n${newPluginsPropText}`)
            }
          } else if (ts.isArrayLiteralExpression(pluginsProperty.initializer)) {
            const pluginsArray = pluginsProperty.initializer

            // Check if @effect/language-service plugin already exists
            const lspPluginElement = pluginsArray.elements.find((element) => {
              if (ts.isObjectLiteralExpression(element)) {
                const nameProperty = findPropertyInObject(ts, element, "name")
                if (nameProperty && ts.isStringLiteral(nameProperty.initializer)) {
                  return (nameProperty.initializer as ts.StringLiteral).text === "@effect/language-service"
                }
              }
              return false
            })

            if (lspPluginElement) {
              // Plugin already exists - check if we need to update it
              if (Option.isSome(target.diagnosticSeverities)) {
                descriptions.push("Update @effect/language-service plugin diagnostic severities")
                tracker.replaceNode(current.sourceFile, lspPluginElement, pluginObject)
              }
              // else: plugin exists and no changes needed
            } else {
              // Add plugin to existing array
              descriptions.push("Add @effect/language-service plugin to existing plugins array")

              if (pluginsArray.elements.length > 0) {
                const lastElement = pluginsArray.elements[pluginsArray.elements.length - 1]
                // Manually insert with comma
                const pluginObjectText = printer.printNode(ts.EmitHint.Unspecified, pluginObject, current.sourceFile)
                tracker.insertText(current.sourceFile, lastElement.getEnd(), `,\n${pluginObjectText}`)
              } else {
                // Empty array
                tracker.insertNodeAt(
                  current.sourceFile,
                  pluginsArray.getStart(current.sourceFile) + 1,
                  pluginObject
                )
              }
            }
          }
        }
      }
    )

    // Extract text changes for this file
    const fileChange = fileChanges.find((fc: ts.FileTextChanges) => fc.fileName === current.path)
    const changes = fileChange ? fileChange.textChanges : []

    return {
      filePath: current.path,
      sourceFile: current.sourceFile,
      textChanges: changes,
      description: descriptions.join("; ")
    }
  })
}

/**
 * Compute .vscode/settings.json changes
 */
const computeVSCodeSettingsChanges = (
  current: Assessment.VSCodeSettings,
  target: Target.VSCodeSettings
): Effect.Effect<FileChange> => {
  return Effect.gen(function*() {
    const textChanges: Array<ts.TextChange> = []
    const descriptions: Array<string> = []

    // TODO: Implement VSCode settings modification logic
    // - Merge target settings with current settings
    // - Generate text changes for modified settings

    const changedSettings = Object.keys(target.settings).filter((key) => {
      return current.settings[key] !== target.settings[key]
    })

    if (changedSettings.length > 0) {
      descriptions.push(`Update ${changedSettings.length} VSCode settings`)
      // TODO: Generate text changes for updating settings
    }

    return {
      filePath: current.path,
      sourceFile: current.sourceFile,
      textChanges,
      description: descriptions.join("; ")
    }
  })
}
