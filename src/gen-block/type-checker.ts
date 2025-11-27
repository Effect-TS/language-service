/**
 * Gen-block aware TypeScript type checker
 *
 * Provides type checking for files with gen {} syntax by:
 * 1. Transforming gen blocks before TypeScript parses them
 * 2. Running TypeScript's type checker on transformed code
 * 3. Mapping diagnostic positions back to original source
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type * as ts from "typescript"
import { cacheTransformation, mapTransformedToOriginal, type SourceMapData } from "./position-mapper"
import { hasGenBlocks, transformSource } from "./transformer"

export interface GenBlockTypeCheckerOptions {
  /** TypeScript instance to use */
  typescript: typeof ts
  /** Path to tsconfig.json */
  configPath: string
  /** Optional list of specific files to check (overrides tsconfig) */
  files?: Array<string>
}

export interface GenBlockDiagnostic {
  file: string
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
  code: number
  category: "error" | "warning" | "message"
  /** Whether this diagnostic is from a gen-block file */
  isGenBlockFile: boolean
}

export interface GenBlockTypeCheckResult {
  diagnostics: Array<GenBlockDiagnostic>
  filesChecked: number
  genBlockFilesCount: number
}

/**
 * Create a transforming compiler host that processes gen blocks
 */
export function createTransformingCompilerHost(
  tsInstance: typeof ts,
  options: ts.CompilerOptions,
  genBlockFiles: Set<string>
): ts.CompilerHost {
  const defaultHost = tsInstance.createCompilerHost(options)

  return {
    ...defaultHost,

    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
      // Skip transformation for node_modules and declaration files
      if (fileName.includes("node_modules") || fileName.endsWith(".d.ts")) {
        return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      }

      const sourceText = defaultHost.readFile(fileName)
      if (!sourceText) {
        return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      }

      // Check if file contains gen blocks
      if (!hasGenBlocks(sourceText)) {
        return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      }

      // Transform gen blocks
      const result = transformSource(sourceText, fileName)

      if (result.hasChanges && result.map) {
        // Track this as a gen-block file
        genBlockFiles.add(fileName)

        // Cache transformation for position mapping using the source map
        cacheTransformation(
          fileName,
          sourceText,
          result.code,
          result.map as SourceMapData
        )

        // Create source file from transformed code
        return tsInstance.createSourceFile(
          fileName,
          result.code,
          languageVersion,
          true
        )
      }

      return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    }
  }
}

/**
 * Convert TypeScript diagnostic category to string
 */
function categoryToString(
  category: ts.DiagnosticCategory,
  tsInstance: typeof ts
): "error" | "warning" | "message" {
  switch (category) {
    case tsInstance.DiagnosticCategory.Error:
      return "error"
    case tsInstance.DiagnosticCategory.Warning:
      return "warning"
    default:
      return "message"
  }
}

/**
 * Map a diagnostic to our format, translating positions for gen-block files
 */
function mapDiagnostic(
  diagnostic: ts.Diagnostic,
  tsInstance: typeof ts,
  genBlockFiles: Set<string>
): GenBlockDiagnostic | undefined {
  if (!diagnostic.file || diagnostic.start === undefined) {
    return undefined
  }

  const fileName = diagnostic.file.fileName
  const isGenBlockFile = genBlockFiles.has(fileName)

  // Map position back to original if this is a gen-block file
  const originalStart = isGenBlockFile
    ? mapTransformedToOriginal(fileName, diagnostic.start)
    : diagnostic.start

  const endPos = diagnostic.start + (diagnostic.length ?? 0)
  const originalEnd = isGenBlockFile
    ? mapTransformedToOriginal(fileName, endPos)
    : endPos

  // Get line/column for original positions
  // Note: For gen-block files, we'd ideally reparse the original source
  // For now, use the transformed source file's positions
  const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(originalStart)
  const { character: endCharacter, line: endLine } = diagnostic.file.getLineAndCharacterOfPosition(originalEnd)

  return {
    file: fileName,
    line: line + 1,
    column: character + 1,
    endLine: endLine + 1,
    endColumn: endCharacter + 1,
    message: tsInstance.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    code: diagnostic.code,
    category: categoryToString(diagnostic.category, tsInstance),
    isGenBlockFile
  }
}

/**
 * Run type checking on a project with gen-block support
 */
export function checkProject(options: GenBlockTypeCheckerOptions): GenBlockTypeCheckResult {
  const { configPath, typescript: tsInstance } = options

  // Read and parse tsconfig
  const configFile = tsInstance.readConfigFile(configPath, tsInstance.sys.readFile)
  if (configFile.error) {
    return {
      diagnostics: [{
        file: configPath,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: tsInstance.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
        code: configFile.error.code,
        category: "error",
        isGenBlockFile: false
      }],
      filesChecked: 0,
      genBlockFilesCount: 0
    }
  }

  const parsed = tsInstance.parseJsonConfigFileContent(
    configFile.config,
    tsInstance.sys,
    path.dirname(configPath)
  )

  // Determine files to check
  const filesToCheck = options.files ?? parsed.fileNames

  // Track gen-block files
  const genBlockFiles = new Set<string>()

  // Create transforming compiler host
  const host = createTransformingCompilerHost(tsInstance, parsed.options, genBlockFiles)

  // Create program
  const program = tsInstance.createProgram(filesToCheck, parsed.options, host)

  // Get diagnostics
  const allDiagnostics: Array<ts.Diagnostic> = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics()
  ]

  // Map diagnostics
  const mappedDiagnostics: Array<GenBlockDiagnostic> = []
  for (const diagnostic of allDiagnostics) {
    const mapped = mapDiagnostic(diagnostic, tsInstance, genBlockFiles)
    if (mapped) {
      mappedDiagnostics.push(mapped)
    }
  }

  return {
    diagnostics: mappedDiagnostics,
    filesChecked: filesToCheck.length,
    genBlockFilesCount: genBlockFiles.size
  }
}

/**
 * Check a single file with gen-block support
 *
 * Creates a minimal program just for the specified file
 */
export function checkFile(
  tsInstance: typeof ts,
  filePath: string,
  compilerOptions?: ts.CompilerOptions
): GenBlockTypeCheckResult {
  const resolvedPath = path.resolve(filePath)

  // Default compiler options for single-file checking
  const options: ts.CompilerOptions = {
    target: tsInstance.ScriptTarget.ESNext,
    module: tsInstance.ModuleKind.ESNext,
    moduleResolution: tsInstance.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    ...compilerOptions
  }

  // Track gen-block files
  const genBlockFiles = new Set<string>()

  // Create transforming compiler host
  const host = createTransformingCompilerHost(tsInstance, options, genBlockFiles)

  // Create program for single file
  const program = tsInstance.createProgram([resolvedPath], options, host)

  // Get diagnostics for this file only
  const sourceFile = program.getSourceFile(resolvedPath)
  if (!sourceFile) {
    return {
      diagnostics: [{
        file: resolvedPath,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: `Could not find source file: ${resolvedPath}`,
        code: -1,
        category: "error",
        isGenBlockFile: false
      }],
      filesChecked: 0,
      genBlockFilesCount: 0
    }
  }

  const allDiagnostics: Array<ts.Diagnostic> = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile)
  ]

  // Map diagnostics
  const mappedDiagnostics: Array<GenBlockDiagnostic> = []
  for (const diagnostic of allDiagnostics) {
    const mapped = mapDiagnostic(diagnostic, tsInstance, genBlockFiles)
    if (mapped) {
      mappedDiagnostics.push(mapped)
    }
  }

  return {
    diagnostics: mappedDiagnostics,
    filesChecked: 1,
    genBlockFilesCount: genBlockFiles.size
  }
}

/**
 * Read a file and check if it contains gen blocks
 */
export function fileHasGenBlocks(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return hasGenBlocks(content)
  } catch {
    return false
  }
}
