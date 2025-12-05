import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import type { LanguageServicePluginOptions } from "../../core/LanguageServicePluginOptions"
import { parse as parseOptions } from "../../core/LanguageServicePluginOptions"
import { getTypeScript } from "../utils"

/**
 * Assessment namespace containing all assessment-related types
 */
export namespace Assessment {
  /**
   * Package.json assessment result
   */
  export interface PackageJson {
    readonly path: string
    readonly sourceFile: ts.JsonSourceFile // AST for modification
    readonly lspVersion: Option.Option<{
      readonly dependencyType: "dependencies" | "devDependencies"
      readonly version: string
    }> // None = not installed
    readonly prepareScript: Option.Option<{
      readonly script: string
      readonly hasPatch: boolean
    }> // None = no prepare script
  }

  /**
   * tsconfig.json assessment result
   */
  export interface TsConfig {
    readonly path: string
    readonly sourceFile: ts.JsonSourceFile // AST for modification
    readonly hasPlugins: boolean
    readonly currentOptions: Option.Option<LanguageServicePluginOptions> // None if plugin not configured
  }

  /**
   * .vscode/settings.json assessment result
   */
  export interface VSCodeSettings {
    readonly path: string
    readonly sourceFile: ts.JsonSourceFile // AST for modification
    readonly settings: Record<string, unknown> // Parsed JSON content
  }

  /**
   * Complete assessment state collected during the assessment phase
   */
  export interface State {
    readonly packageJson: Option.Option<PackageJson>
    readonly tsconfig: Option.Option<TsConfig>
    readonly vscodeSettings: Option.Option<VSCodeSettings>
  }
}

/**
 * Check if package.json exists and analyze it
 */
export const assessPackageJson = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const ts = yield* getTypeScript
  const packageJsonPath = path.resolve("package.json")

  // Check if package.json exists
  const exists = yield* fs.exists(packageJsonPath)
  if (!exists) {
    return Option.none<Assessment.PackageJson>()
  }

  // Read and parse package.json using TypeScript API
  const content = yield* fs.readFileString(packageJsonPath)
  const jsonSourceFile = ts.parseJsonText(packageJsonPath, content)
  const errors: Array<ts.Diagnostic> = []
  const packageJson = ts.convertToObject(jsonSourceFile, errors) as {
    devDependencies?: Record<string, string>
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
  }

  // Check for @effect/language-service in both dependencies and devDependencies
  let lspVersion: Option.Option<
    { readonly dependencyType: "dependencies" | "devDependencies"; readonly version: string }
  > = Option.none()

  if ("@effect/language-service" in (packageJson.devDependencies ?? {})) {
    lspVersion = Option.some({
      dependencyType: "devDependencies" as const,
      version: packageJson.devDependencies!["@effect/language-service"]
    })
  } else if ("@effect/language-service" in (packageJson.dependencies ?? {})) {
    lspVersion = Option.some({
      dependencyType: "dependencies" as const,
      version: packageJson.dependencies!["@effect/language-service"]
    })
  }

  // Check for prepare script
  const prepareScript = "prepare" in (packageJson.scripts ?? {})
    ? Option.some({
      script: packageJson.scripts!.prepare,
      hasPatch: packageJson.scripts!.prepare.toLowerCase().includes("effect-language-service")
    })
    : Option.none()

  return Option.some<Assessment.PackageJson>({
    path: packageJsonPath,
    sourceFile: jsonSourceFile,
    lspVersion,
    prepareScript
  })
})

/**
 * Find all tsconfig files in the current directory
 */
export const findTsConfigFiles = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Read current directory
  const currentDir = path.resolve(".")
  const files = yield* fs.readDirectory(currentDir)

  // Filter for tsconfig*.json or tsconfig*.jsonc files
  const tsconfigFiles = Array.filter(files, (file) => {
    const fileName = file.toLowerCase()
    return (fileName.startsWith("tsconfig") && (fileName.endsWith(".json") || fileName.endsWith(".jsonc")))
  })

  // Return full paths
  return Array.map(tsconfigFiles, (file) => path.join(currentDir, file))
})

/**
 * Analyze a specific tsconfig file
 */
export const analyzeTsConfig = (tsconfigPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const ts = yield* getTypeScript

    // Read and parse tsconfig using TypeScript API
    const content = yield* fs.readFileString(tsconfigPath)
    const jsonSourceFile = ts.parseJsonText(tsconfigPath, content)
    const errors: Array<ts.Diagnostic> = []
    const tsconfig = ts.convertToObject(jsonSourceFile, errors) as {
      compilerOptions?: {
        plugins?: Array<{
          name?: string
          [key: string]: unknown
        }>
      }
    }

    // Check for plugins section
    const hasPlugins = tsconfig.compilerOptions?.plugins !== undefined
    const plugins = tsconfig.compilerOptions?.plugins ?? []

    // Find @effect/language-service plugin
    const lspPlugin = Array.findFirst(plugins, (plugin) => plugin.name === "@effect/language-service")

    // Parse current configuration only if plugin is present
    const currentOptions = Option.isSome(lspPlugin)
      ? Option.some(parseOptions(lspPlugin.value))
      : Option.none()

    const result: Assessment.TsConfig = {
      path: tsconfigPath,
      sourceFile: jsonSourceFile,
      hasPlugins,
      currentOptions
    }
    return result
  })

/**
 * Check if .vscode/settings.json exists and parse it
 */
export const assessVSCodeSettings = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const ts = yield* getTypeScript
  const settingsPath = path.join(path.resolve("."), ".vscode", "settings.json")

  // Check if .vscode/settings.json exists
  const exists = yield* fs.exists(settingsPath)
  if (!exists) {
    return Option.none<Assessment.VSCodeSettings>()
  }

  // Read and parse settings.json using TypeScript API
  const content = yield* fs.readFileString(settingsPath)
  const jsonSourceFile = ts.parseJsonText(settingsPath, content)
  const errors: Array<ts.Diagnostic> = []
  const settings = ts.convertToObject(jsonSourceFile, errors) as Record<string, unknown>

  return Option.some<Assessment.VSCodeSettings>({
    path: settingsPath,
    sourceFile: jsonSourceFile,
    settings
  })
})
