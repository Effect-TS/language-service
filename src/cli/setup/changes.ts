import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
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
): Effect.Effect<ReadonlyArray<FileChange>> => {
  return Effect.gen(function*() {
    const changes: Array<FileChange> = []

    // Compute package.json changes
    if (Option.isSome(target.packageJson) && Option.isSome(assessment.packageJson)) {
      const packageJsonChanges = yield* computePackageJsonChanges(
        assessment.packageJson.value,
        target.packageJson.value
      )
      if (packageJsonChanges.textChanges.length > 0) {
        changes.push(packageJsonChanges)
      }
    }

    // Compute tsconfig changes
    if (Option.isSome(target.tsconfig) && Option.isSome(assessment.tsconfig)) {
      const tsconfigChanges = yield* computeTsConfigChanges(
        assessment.tsconfig.value,
        target.tsconfig.value
      )
      if (tsconfigChanges.textChanges.length > 0) {
        changes.push(tsconfigChanges)
      }
    }

    // Compute VSCode settings changes
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
 * Compute package.json changes
 */
const computePackageJsonChanges = (
  current: Assessment.PackageJson,
  target: Target.PackageJson
): Effect.Effect<FileChange> => {
  return Effect.gen(function*() {
    const textChanges: Array<ts.TextChange> = []
    const descriptions: Array<string> = []

    // TODO: Implement package.json modification logic
    // - Add @effect/language-service to devDependencies if shouldInstallLsp
    // - Add/modify prepare script if shouldAddPrepareScript

    if (target.shouldInstallLsp) {
      descriptions.push("Add @effect/language-service to devDependencies")
      // TODO: Generate text change for adding devDependency
    }

    if (target.shouldAddPrepareScript) {
      descriptions.push("Add prepare script with effect-language-service patch")
      // TODO: Generate text change for adding prepare script
    }

    return {
      filePath: current.path,
      sourceFile: current.sourceFile,
      textChanges,
      description: descriptions.join("; ")
    }
  })
}

/**
 * Compute tsconfig.json changes
 */
const computeTsConfigChanges = (
  current: Assessment.TsConfig,
  target: Target.TsConfig
): Effect.Effect<FileChange> => {
  return Effect.gen(function*() {
    const textChanges: Array<ts.TextChange> = []
    const descriptions: Array<string> = []

    // TODO: Implement tsconfig modification logic
    // - Add plugins section if needed
    // - Add/modify @effect/language-service plugin configuration
    // - Update diagnostic severities

    if (target.shouldAddLspPlugin) {
      descriptions.push("Add @effect/language-service plugin to compilerOptions.plugins")
      // TODO: Generate text change for adding plugin
    }

    const changedSeverities = Object.entries(target.diagnosticSeverities).filter(([name, severity]) => {
      if (Option.isNone(current.currentOptions)) return true
      return current.currentOptions.value.diagnosticSeverity[name] !== severity
    })

    if (changedSeverities.length > 0) {
      descriptions.push(`Update ${changedSeverities.length} diagnostic severity settings`)
      // TODO: Generate text changes for updating severities
    }

    return {
      filePath: current.path,
      sourceFile: current.sourceFile,
      textChanges,
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
