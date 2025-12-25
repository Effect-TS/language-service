import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import { type TypeScriptApi, TypeScriptContext } from "../utils"
import type { Assessment } from "./assessment"
import type { Target } from "./target"

/**
 * Result of computing changes for a single file
 */
interface ComputeFileChangesResult {
  readonly codeActions: ReadonlyArray<ts.CodeAction>
  readonly messages: ReadonlyArray<string>
}

/**
 * Create an empty ComputeFileChangesResult
 */
function emptyFileChangesResult(): ComputeFileChangesResult {
  return {
    codeActions: [],
    messages: []
  }
}

/**
 * Result of computing all changes
 */
export interface ComputeChangesResult {
  readonly codeActions: ReadonlyArray<ts.CodeAction>
  readonly messages: ReadonlyArray<string> // Warning/info messages for the user
}

/**
 * Compute the set of changes needed to go from assessment state to target state
 * Returns CodeActions with descriptions and file changes, plus messages for the user
 */
export const computeChanges = (
  assessment: Assessment.State,
  target: Target.State
): Effect.Effect<ComputeChangesResult, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    let codeActions: ReadonlyArray<ts.CodeAction> = []
    let messages: ReadonlyArray<string> = []

    // Compute package.json changes (always present)
    const packageJsonResult = yield* computePackageJsonChanges(
      assessment.packageJson,
      target.packageJson
    )
    codeActions = [...codeActions, ...packageJsonResult.codeActions]
    messages = [...messages, ...packageJsonResult.messages]

    // Compute tsconfig changes (always present)
    const tsconfigResult = yield* computeTsConfigChanges(
      assessment.tsconfig,
      target.tsconfig,
      target.packageJson.lspVersion
    )
    codeActions = [...codeActions, ...tsconfigResult.codeActions]
    messages = [...messages, ...tsconfigResult.messages]

    // Compute VSCode settings changes if user selected VSCode editor
    if (target.editors.includes("vscode")) {
      // Create VSCode settings target if user wants LSP installed
      if (Option.isSome(target.packageJson.lspVersion) && Option.isSome(assessment.vscodeSettings)) {
        const vscodeTarget: Target.VSCodeSettings = {
          settings: {
            "typescript.tsdk": "./node_modules/typescript/lib",
            "typescript.enablePromptUseWorkspaceTsdk": true
          }
        }

        const vscodeResult = yield* computeVSCodeSettingsChanges(
          assessment.vscodeSettings.value,
          vscodeTarget
        )
        codeActions = [...codeActions, ...vscodeResult.codeActions]
        messages = [...messages, ...vscodeResult.messages]
      }
    }

    // Add editor-specific setup instructions as messages
    if (Option.isSome(target.packageJson.lspVersion) && target.editors.length > 0) {
      messages = [...messages, ""]

      if (target.editors.includes("vscode")) {
        messages = [
          ...messages,
          "VS Code / Cursor / VS Code-based editors:",
          "  1. Press \"F1\" and type \"TypeScript: Select TypeScript version\"",
          "  2. Select \"Use workspace version\"",
          "  3. If that option does not appear, ensure TypeScript is installed locally in node_modules",
          ""
        ]
      }

      if (target.editors.includes("nvim")) {
        messages = [
          ...messages,
          "Neovim (with nvim-vtsls):",
          "  Refer to: https://github.com/yioneko/vtsls?tab=readme-ov-file#typescript-plugin-not-activated",
          ""
        ]
      }

      if (target.editors.includes("emacs")) {
        messages = [
          ...messages,
          "Emacs:",
          "  Step-by-step instructions: https://gosha.net/2025/effect-ls-emacs/",
          ""
        ]
      }
    }

    return { codeActions, messages }
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
 * Delete a node from a list (array or object properties), handling commas properly
 */
function deleteNodeFromList<T extends ts.Node>(
  tracker: any,
  sourceFile: ts.SourceFile,
  nodeArray: ts.NodeArray<T>,
  nodeToDelete: T
) {
  const index = nodeArray.indexOf(nodeToDelete)
  if (index === -1) return // Node not found in array

  if (index === 0 && nodeArray.length > 1) {
    // Deleting first element - delete from start of first to start of second
    const secondElement = nodeArray[1]
    const start = nodeToDelete.pos
    const end = secondElement.pos
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else if (index > 0) {
    // Deleting non-first element - delete from end of previous to end of current
    const previousElement = nodeArray[index - 1]
    const start = previousElement.end
    const end = nodeToDelete.end
    tracker.deleteRange(sourceFile, { pos: start, end })
  } else {
    // Only element in the list - just delete it
    tracker.delete(sourceFile, nodeToDelete)
  }
}

/**
 * Insert a node at the end of a list (array or object properties), handling commas properly
 */
function insertNodeAtEndOfList<T extends ts.Node>(
  tracker: any,
  sourceFile: ts.SourceFile,
  nodeArray: ts.NodeArray<T>,
  newNode: T
) {
  if (nodeArray.length === 0) {
    // Empty list - insert the node at the beginning with proper spacing
    // For empty JSON objects like {}, we need to insert right after the opening brace
    tracker.insertNodeAt(sourceFile, nodeArray.pos + 1, newNode, { suffix: "\n" })
  } else {
    // Non-empty list - insert node with comma prefix after last element
    const lastElement = nodeArray[nodeArray.length - 1]
    tracker.insertNodeAt(sourceFile, lastElement.end, newNode, { prefix: ",\n" })
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
): Effect.Effect<ComputeFileChangesResult, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const ts = yield* TypeScriptContext
    const descriptions: Array<string> = []
    const messages: Array<string> = []

    const rootObj = getRootObject(ts, current.sourceFile)
    if (!rootObj) {
      return emptyFileChangesResult()
    }

    // Use ChangeTracker API
    const host = createMinimalHost(ts)
    const formatOptions = { indentSize: 2, tabSize: 2 } as ts.EditorSettings
    const formatContext = ts.formatting.getFormatContext(formatOptions, host)
    const preferences = {} as ts.UserPreferences

    const fileChanges = ts.textChanges.ChangeTracker.with(
      { host, formatContext, preferences },
      (tracker: any) => {
        // Handle @effect/language-service dependency
        if (Option.isSome(target.lspVersion)) {
          // User wants to install LSP
          const targetDepType = target.lspVersion.value.dependencyType
          const targetVersion = target.lspVersion.value.version

          // Check if LSP is currently installed in a different dependency type
          if (Option.isSome(current.lspVersion)) {
            const currentDepType = current.lspVersion.value.dependencyType
            const currentVersion = current.lspVersion.value.version

            // If dependency type changed, remove from old location and add to new location
            if (currentDepType !== targetDepType) {
              descriptions.push(`Move @effect/language-service from ${currentDepType} to ${targetDepType}`)

              // Remove from old location
              const oldDepsProperty = findPropertyInObject(ts, rootObj, currentDepType)
              if (oldDepsProperty && ts.isObjectLiteralExpression(oldDepsProperty.initializer)) {
                const lspProperty = findPropertyInObject(ts, oldDepsProperty.initializer, "@effect/language-service")
                if (lspProperty) {
                  deleteNodeFromList(tracker, current.sourceFile, oldDepsProperty.initializer.properties, lspProperty)
                }
              }

              // Add to new location
              const newDepsProperty = findPropertyInObject(ts, rootObj, targetDepType)
              const newLspProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral("@effect/language-service"),
                ts.factory.createStringLiteral(targetVersion)
              )

              if (!newDepsProperty) {
                // Need to add entire dependencies section
                const newDepsProp = ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral(targetDepType),
                  ts.factory.createObjectLiteralExpression([newLspProp], false)
                )
                insertNodeAtEndOfList(tracker, current.sourceFile, rootObj.properties, newDepsProp)
              } else if (ts.isObjectLiteralExpression(newDepsProperty.initializer)) {
                insertNodeAtEndOfList(tracker, current.sourceFile, newDepsProperty.initializer.properties, newLspProp)
              }
            } else if (currentVersion !== targetVersion) {
              // Same dependency type, just update version
              descriptions.push(`Update @effect/language-service from ${currentVersion} to ${targetVersion}`)

              const depsProperty = findPropertyInObject(ts, rootObj, targetDepType)
              if (depsProperty && ts.isObjectLiteralExpression(depsProperty.initializer)) {
                const lspProperty = findPropertyInObject(ts, depsProperty.initializer, "@effect/language-service")
                if (lspProperty && ts.isStringLiteral(lspProperty.initializer)) {
                  // Update just the version string value
                  const newVersionLiteral = ts.factory.createStringLiteral(targetVersion)
                  tracker.replaceNode(current.sourceFile, lspProperty.initializer, newVersionLiteral)
                }
              }
            }
            // If both dependency type and version are the same, no changes needed
          } else {
            // LSP not currently installed, add it
            descriptions.push(`Add @effect/language-service@${targetVersion} to ${targetDepType}`)

            const depsProperty = findPropertyInObject(ts, rootObj, targetDepType)

            if (!depsProperty) {
              // Need to add entire dependencies section to root object
              const newDepsProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral(targetDepType),
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment(
                    ts.factory.createStringLiteral("@effect/language-service"),
                    ts.factory.createStringLiteral(targetVersion)
                  )
                ], false)
              )
              insertNodeAtEndOfList(tracker, current.sourceFile, rootObj.properties, newDepsProp)
            } else if (ts.isObjectLiteralExpression(depsProperty.initializer)) {
              // Add to existing dependencies
              const newLspProp = ts.factory.createPropertyAssignment(
                ts.factory.createStringLiteral("@effect/language-service"),
                ts.factory.createStringLiteral(targetVersion)
              )

              const depsObj = depsProperty.initializer
              insertNodeAtEndOfList(tracker, current.sourceFile, depsObj.properties, newLspProp)
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
              // Remove from dependencies
              const depsObj = depsProperty.initializer
              deleteNodeFromList(tracker, current.sourceFile, depsObj.properties, lspProperty)
            }
          }
        }

        // Handle prepare script
        if (target.prepareScript && Option.isSome(target.lspVersion)) {
          // User wants LSP and prepare script
          const scriptsProperty = findPropertyInObject(ts, rootObj, "scripts")

          if (!scriptsProperty) {
            // Need to add entire scripts section to root object
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
            insertNodeAtEndOfList(tracker, current.sourceFile, rootObj.properties, newScriptsProp)
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
              insertNodeAtEndOfList(tracker, current.sourceFile, scriptsObj.properties, newPrepareProp)
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
          Option.isNone(target.lspVersion) && Option.isSome(current.prepareScript) &&
          current.prepareScript.value.hasPatch
        ) {
          // User wants to remove LSP and prepare script has patch command
          const scriptsProperty = findPropertyInObject(ts, rootObj, "scripts")
          if (scriptsProperty && ts.isObjectLiteralExpression(scriptsProperty.initializer)) {
            const prepareProperty = findPropertyInObject(ts, scriptsProperty.initializer, "prepare")
            if (prepareProperty && ts.isStringLiteral(prepareProperty.initializer)) {
              const currentScript = current.prepareScript.value.script

              // Check if there are multiple commands (separated by && or ;)
              const hasMultipleCommands = currentScript.includes("&&") || currentScript.includes(";")

              if (hasMultipleCommands) {
                // Remove only the patch command, keep other commands
                descriptions.push("Remove effect-language-service patch command from prepare script")

                // Add warning message for user to verify
                messages.push(
                  "WARNING: Your prepare script contained multiple commands. " +
                    "I attempted to automatically remove only the 'effect-language-service patch' command. " +
                    "Please verify that the prepare script is correct after this change."
                )

                // Remove the patch command and clean up separators
                const newScript = currentScript
                  .replace(/\s*&&\s*effect-language-service\s+patch/g, "") // Remove && patch
                  .replace(/effect-language-service\s+patch\s*&&\s*/g, "") // Remove patch &&
                  .replace(/\s*;\s*effect-language-service\s+patch/g, "") // Remove ; patch
                  .replace(/effect-language-service\s+patch\s*;\s*/g, "") // Remove patch ;
                  .trim()

                if (ts.isStringLiteral(prepareProperty.initializer)) {
                  tracker.replaceNode(
                    current.sourceFile,
                    prepareProperty.initializer,
                    ts.factory.createStringLiteral(newScript)
                  )
                }
              } else {
                // Only command is the patch command, remove entire prepare script
                descriptions.push("Remove prepare script with patch command")
                const scriptsObj = scriptsProperty.initializer
                deleteNodeFromList(tracker, current.sourceFile, scriptsObj.properties, prepareProperty)
              }
            }
          }
        }
      }
    )

    // Extract text changes for this file
    const fileChange = fileChanges.find((fc: ts.FileTextChanges) => fc.fileName === current.path)
    const changes = fileChange ? fileChange.textChanges : []

    // Return empty result if no changes
    if (changes.length === 0) {
      return { codeActions: [], messages }
    }

    // Create and return result with CodeAction and messages
    return {
      codeActions: [{
        description: descriptions.join("; "),
        changes: [{
          fileName: current.path,
          textChanges: changes
        }]
      }],
      messages
    }
  })
}

/**
 * Compute tsconfig.json changes using ChangeTracker
 */
const computeTsConfigChanges = (
  current: Assessment.TsConfig,
  target: Target.TsConfig,
  lspVersion: Option.Option<{ readonly dependencyType: "devDependencies" | "dependencies"; readonly version: string }>
): Effect.Effect<ComputeFileChangesResult, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const ts = yield* TypeScriptContext
    const descriptions: Array<string> = []
    const messages: Array<string> = []

    const rootObj = getRootObject(ts, current.sourceFile)
    if (!rootObj) {
      return emptyFileChangesResult()
    }

    // Find or create compilerOptions
    const compilerOptionsProperty = findPropertyInObject(ts, rootObj, "compilerOptions")
    if (!compilerOptionsProperty) {
      return emptyFileChangesResult()
    }

    if (!ts.isObjectLiteralExpression(compilerOptionsProperty.initializer)) {
      return emptyFileChangesResult()
    }

    const compilerOptions = compilerOptionsProperty.initializer

    // Use ChangeTracker API
    const textChanges = ts.textChanges
    const host = createMinimalHost(ts)
    const formatOptions = { indentSize: 2, tabSize: 2 } as ts.EditorSettings
    const formatContext = ts.formatting.getFormatContext(formatOptions, host)
    const preferences = {} as ts.UserPreferences

    const fileChanges = textChanges.ChangeTracker.with(
      { host, formatContext, preferences },
      (tracker: any) => {
        const pluginsProperty = findPropertyInObject(ts, compilerOptions, "plugins")

        // Check if we should remove the plugin (user doesn't want LSP installed)
        if (Option.isNone(lspVersion)) {
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
              deleteNodeFromList(tracker, current.sourceFile, pluginsArray.elements, lspPluginElement)
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
            // Add entire plugins array with LSP plugin to compilerOptions
            descriptions.push("Add plugins array with @effect/language-service plugin")

            const newPluginsProp = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral("plugins"),
              ts.factory.createArrayLiteralExpression([pluginObject], true)
            )

            insertNodeAtEndOfList(tracker, current.sourceFile, compilerOptions.properties, newPluginsProp)
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
              if (Option.isSome(target.diagnosticSeverities) && ts.isObjectLiteralExpression(lspPluginElement)) {
                descriptions.push("Update @effect/language-service plugin diagnostic severities")

                // Find existing diagnosticSeverity property
                const existingDiagSeverityProp = findPropertyInObject(ts, lspPluginElement, "diagnosticSeverity")

                // Build the new diagnosticSeverity property
                const severityProperties = Object.entries(target.diagnosticSeverities.value).map(([name, severity]) =>
                  ts.factory.createPropertyAssignment(
                    ts.factory.createStringLiteral(name),
                    ts.factory.createStringLiteral(severity)
                  )
                )

                const newDiagnosticSeverityProperty = ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral("diagnosticSeverity"),
                  ts.factory.createObjectLiteralExpression(severityProperties, true)
                )

                if (existingDiagSeverityProp) {
                  // Replace existing diagnosticSeverity property
                  tracker.replaceNode(current.sourceFile, existingDiagSeverityProp, newDiagnosticSeverityProperty)
                } else {
                  // Add diagnosticSeverity property to existing plugin object
                  insertNodeAtEndOfList(
                    tracker,
                    current.sourceFile,
                    lspPluginElement.properties,
                    newDiagnosticSeverityProperty
                  )
                }
              }
              // else: plugin exists and no changes needed
            } else {
              // Add plugin to existing array
              descriptions.push("Add @effect/language-service plugin to existing plugins array")

              insertNodeAtEndOfList(tracker, current.sourceFile, pluginsArray.elements, pluginObject)
            }
          }
        }
      }
    )

    // Extract text changes for this file
    const fileChange = fileChanges.find((fc: ts.FileTextChanges) => fc.fileName === current.path)
    const changes = fileChange ? fileChange.textChanges : []

    // Return empty result if no changes
    if (changes.length === 0) {
      return { codeActions: [], messages }
    }

    // Create and return result with CodeAction and messages
    return {
      codeActions: [{
        description: descriptions.join("; "),
        changes: [{
          fileName: current.sourceFile.fileName,
          textChanges: changes
        }]
      }],
      messages
    }
  })
}

/**
 * Compute .vscode/settings.json changes
 */
const computeVSCodeSettingsChanges = (
  current: Assessment.VSCodeSettings,
  target: Target.VSCodeSettings
): Effect.Effect<ComputeFileChangesResult, never, TypeScriptContext> => {
  return Effect.gen(function*() {
    const ts = yield* TypeScriptContext
    const descriptions: Array<string> = []
    const messages: Array<string> = []

    const rootObj = getRootObject(ts, current.sourceFile)
    if (!rootObj) {
      return emptyFileChangesResult()
    }

    // Use ChangeTracker API
    const host = createMinimalHost(ts)
    const formatOptions = { indentSize: 2, tabSize: 2 } as ts.EditorSettings
    const formatContext = ts.formatting.getFormatContext(formatOptions, host)
    const preferences = {} as ts.UserPreferences

    // Build new properties list
    const newProperties: Array<ts.PropertyAssignment> = []
    const propsToUpdate: Array<{ old: ts.PropertyAssignment; new: ts.PropertyAssignment }> = []

    // Keep existing properties and track updates
    for (const prop of rootObj.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const propName = ts.isStringLiteral(prop.name)
          ? (prop.name as ts.StringLiteral).text
          : ts.isIdentifier(prop.name)
          ? ts.idText(prop.name)
          : undefined

        if (propName && propName in target.settings) {
          const value = target.settings[propName]
          if (current.settings[propName] !== value) {
            // Update this property
            descriptions.push(`Update ${propName} setting`)
            const newProp = ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(propName),
              typeof value === "string"
                ? ts.factory.createStringLiteral(value)
                : typeof value === "boolean"
                ? value ? ts.factory.createTrue() : ts.factory.createFalse()
                : ts.factory.createNull()
            )
            propsToUpdate.push({ old: prop, new: newProp })
            newProperties.push(newProp)
          } else {
            newProperties.push(prop)
          }
        } else {
          // Keep existing property
          newProperties.push(prop)
        }
      }
    }

    // Add new properties
    for (const [key, value] of Object.entries(target.settings)) {
      const existingProp = findPropertyInObject(ts, rootObj, key)
      if (!existingProp) {
        descriptions.push(`Add ${key} setting`)
        const newProp = ts.factory.createPropertyAssignment(
          ts.factory.createStringLiteral(key),
          typeof value === "string"
            ? ts.factory.createStringLiteral(value)
            : typeof value === "boolean"
            ? value ? ts.factory.createTrue() : ts.factory.createFalse()
            : ts.factory.createNull()
        )
        newProperties.push(newProp)
      }
    }

    const fileChanges = ts.textChanges.ChangeTracker.with(
      { host, formatContext, preferences },
      (tracker: any) => {
        // Replace the entire root object with updated properties
        if (newProperties.length !== rootObj.properties.length || propsToUpdate.length > 0) {
          const newRootObj = ts.factory.createObjectLiteralExpression(newProperties, true)
          tracker.replaceNode(current.sourceFile, rootObj, newRootObj)
        }
      }
    )

    // Extract text changes for this file
    const fileChange = fileChanges.find((fc: ts.FileTextChanges) => fc.fileName === current.path)
    const changes = fileChange ? fileChange.textChanges : []

    // Return empty result if no changes
    if (changes.length === 0) {
      return { codeActions: [], messages }
    }

    // Create and return result with CodeAction and messages
    return {
      codeActions: [{
        description: descriptions.join("; "),
        changes: [{
          fileName: current.path,
          textChanges: changes
        }]
      }],
      messages
    }
  })
}
