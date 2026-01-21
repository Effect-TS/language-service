import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import type { LanguageServicePluginOptions } from "../../core/LanguageServicePluginOptions"
import { parse as parseOptions } from "../../core/LanguageServicePluginOptions"
import { type FileInput, TypeScriptContext } from "../utils"

/**
 * Markers used to identify the effect-language-service section in markdown files
 */
export const MARKDOWN_START_MARKER = "<!-- effect-language-service:start -->"
export const MARKDOWN_END_MARKER = "<!-- effect-language-service:end -->"

/**
 * Default content to add between markers in markdown files
 */
export const MARKDOWN_DEFAULT_CONTENT = `${MARKDOWN_START_MARKER}
## Effect Language Service

The Effect Language Service comes in with a useful CLI that can help you with commands to get a better understanding your Effect Layers and Services, and to help you compose them correctly.
${MARKDOWN_END_MARKER}`

/**
 * Assessment namespace containing all assessment-related types
 */
export namespace Assessment {
  /**
   * Input structure for assessment
   */
  export interface Input {
    readonly packageJson: FileInput // Required
    readonly tsconfig: FileInput // Required
    readonly vscodeSettings: Option.Option<FileInput> // Optional
    readonly agentsMd: Option.Option<FileInput> // Optional - agents.md
    readonly claudeMd: Option.Option<FileInput> // Optional - CLAUDE.md
  }

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
   * Markdown file assessment result (for CLAUDE.md or agents.md)
   */
  export interface MarkdownDoc {
    readonly path: string
    readonly text: string // Original file content
    readonly hasMarkers: boolean // Whether the markers exist
    readonly markerContent: Option.Option<string> // Content between markers (None if no markers)
  }

  /**
   * Complete assessment state collected during the assessment phase
   */
  export interface State {
    readonly packageJson: PackageJson // Required
    readonly tsconfig: TsConfig // Required
    readonly vscodeSettings: Option.Option<VSCodeSettings> // Optional
    readonly agentsMd: Option.Option<MarkdownDoc> // Optional - agents.md
    readonly claudeMd: Option.Option<MarkdownDoc> // Optional - CLAUDE.md
  }
}

/**
 * Assess package.json from input
 */
const assessPackageJsonFromInput = (
  input: FileInput
): Effect.Effect<Assessment.PackageJson, never, TypeScriptContext> =>
  Effect.gen(function*() {
    const ts = yield* TypeScriptContext

    // Parse package.json using TypeScript API
    const jsonSourceFile = ts.parseJsonText(input.fileName, input.text)
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

    return {
      path: input.fileName,
      sourceFile: jsonSourceFile,
      lspVersion,
      prepareScript
    }
  })

/**
 * Assess tsconfig from input
 */
const assessTsConfigFromInput = (
  input: FileInput
): Effect.Effect<Assessment.TsConfig, never, TypeScriptContext> =>
  Effect.gen(function*() {
    const ts = yield* TypeScriptContext

    // Parse tsconfig using TypeScript API
    const jsonSourceFile = ts.parseJsonText(input.fileName, input.text)
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

    return {
      path: input.fileName,
      sourceFile: jsonSourceFile,
      hasPlugins,
      currentOptions
    }
  })

/**
 * Assess VSCode settings from input
 */
const assessVSCodeSettingsFromInput = (
  input: FileInput
): Effect.Effect<Assessment.VSCodeSettings, never, TypeScriptContext> =>
  Effect.gen(function*() {
    const ts = yield* TypeScriptContext

    // Parse settings.json using TypeScript API
    const jsonSourceFile = ts.parseJsonText(input.fileName, input.text)
    const errors: Array<ts.Diagnostic> = []
    const settings = ts.convertToObject(jsonSourceFile, errors) as Record<string, unknown>

    return {
      path: input.fileName,
      sourceFile: jsonSourceFile,
      settings
    }
  })

/**
 * Assess markdown file from input (for CLAUDE.md or agents.md)
 */
const assessMarkdownFromInput = (
  input: FileInput
): Assessment.MarkdownDoc => {
  const text = input.text

  // Find the markers
  const startIndex = text.indexOf(MARKDOWN_START_MARKER)
  const endIndex = text.indexOf(MARKDOWN_END_MARKER)

  const hasMarkers = startIndex !== -1 && endIndex !== -1 && startIndex < endIndex

  // Extract content between markers if they exist
  const markerContent = hasMarkers
    ? Option.some(text.slice(startIndex, endIndex + MARKDOWN_END_MARKER.length))
    : Option.none()

  return {
    path: input.fileName,
    text,
    hasMarkers,
    markerContent
  }
}

/**
 * Perform assessment from input data
 */
export const assess = (
  input: Assessment.Input
): Effect.Effect<Assessment.State, never, TypeScriptContext> =>
  Effect.gen(function*() {
    // Assess package.json (required)
    const packageJson = yield* assessPackageJsonFromInput(input.packageJson)

    // Assess tsconfig (required)
    const tsconfig = yield* assessTsConfigFromInput(input.tsconfig)

    // Assess VSCode settings (optional)
    const vscodeSettings = Option.isSome(input.vscodeSettings)
      ? Option.some(yield* assessVSCodeSettingsFromInput(input.vscodeSettings.value))
      : Option.none<Assessment.VSCodeSettings>()

    // Assess markdown files (optional)
    const agentsMd = Option.isSome(input.agentsMd)
      ? Option.some(assessMarkdownFromInput(input.agentsMd.value))
      : Option.none<Assessment.MarkdownDoc>()

    const claudeMd = Option.isSome(input.claudeMd)
      ? Option.some(assessMarkdownFromInput(input.claudeMd.value))
      : Option.none<Assessment.MarkdownDoc>()

    return {
      packageJson,
      tsconfig,
      vscodeSettings,
      agentsMd,
      claudeMd
    }
  })
