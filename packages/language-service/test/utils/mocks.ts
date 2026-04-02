import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"

export function createMockLanguageServiceHost(
  harnessDir: string,
  examplesDir: string,
  fileName: string,
  sourceText: string,
  compilerOptionsOverrides: ts.CompilerOptions = {}
): ts.LanguageServiceHost {
  const realPath = (fileName: string) => path.isAbsolute(fileName) ? fileName : path.resolve(harnessDir, fileName)

  return {
    getCompilationSettings() {
      return {
        ...ts.getDefaultCompilerOptions(),
        strict: true,
        target: ts.ScriptTarget.ESNext,
        noEmit: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        paths: {
          "@/*": [path.join(examplesDir, "*")]
        },
        ...compilerOptionsOverrides
      }
    },
    getScriptFileNames() {
      return [fileName]
    },
    getScriptVersion(_fileName) {
      return ""
    },
    getScriptSnapshot(_fileName) {
      if (_fileName === fileName) {
        return ts.ScriptSnapshot.fromString(sourceText)
      }
      const resolved = realPath(_fileName)
      if (fs.existsSync(resolved)) {
        return ts.ScriptSnapshot.fromString(fs.readFileSync(resolved).toString())
      }
      const text = ts.sys.readFile(_fileName)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => ".",
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFilePath(options)
    },
    fileExists: (_fileName) => {
      if (_fileName === fileName) return true
      return fs.existsSync(realPath(_fileName)) || ts.sys.fileExists(_fileName)
    },
    readFile: (_fileName) => {
      if (_fileName === fileName) return sourceText
      const resolved = realPath(_fileName)
      if (fs.existsSync(resolved)) {
        return fs.readFileSync(resolved).toString()
      }
      return ts.sys.readFile(_fileName)
    }
  }
}

export function createServicesWithMockedVFS(
  harnessDir: string,
  examplesDir: string,
  fileName: string,
  sourceText: string,
  compilerOptionsOverrides: ts.CompilerOptions = {}
) {
  const languageServiceHost = createMockLanguageServiceHost(
    harnessDir,
    examplesDir,
    fileName,
    sourceText,
    compilerOptionsOverrides
  )
  const languageService = ts.createLanguageService(
    languageServiceHost,
    undefined,
    ts.LanguageServiceMode.Semantic
  )
  const program = languageService.getProgram()
  if (!program) throw new Error("No typescript program!")
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) throw new Error("No source file " + fileName + " in VFS")

  return { languageService, program, sourceFile, languageServiceHost }
}

/**
 * Loop through text changes, and update start and end positions while running
 */
function forEachTextChange(
  changes: ReadonlyArray<ts.TextChange>,
  cb: (change: ts.TextChange) => void
): void {
  changes = JSON.parse(JSON.stringify(changes))
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]!
    cb(change)
    const changeDelta = change.newText.length - change.span.length
    for (let j = i + 1; j < changes.length; j++) {
      if (changes[j]!.span.start >= change.span.start) {
        changes[j]!.span.start += changeDelta
      }
    }
  }
}

export function applyEdits(
  edits: ReadonlyArray<ts.FileTextChanges>,
  fileName: string,
  sourceText: string
): string {
  for (const fileTextChange of edits) {
    if (fileTextChange.fileName === fileName) {
      forEachTextChange(fileTextChange.textChanges, (edit) => {
        const content = sourceText
        const prefix = content.substring(0, edit.span.start)
        const middle = edit.newText
        const suffix = content.substring(edit.span.start + edit.span.length)
        sourceText = prefix + middle + suffix
      })
    }
  }
  return sourceText
}

export function configFromSourceComment(
  sourceText: string
): Record<string, unknown> {
  let commentPosition = sourceText.indexOf("@test-config")
  if (commentPosition === -1) return {}
  commentPosition += "@test-config".length
  const commentEndPosition = sourceText.indexOf("\n", commentPosition)
  if (commentEndPosition === -1) return {}
  const commentText = sourceText.substring(commentPosition, commentEndPosition)
  return JSON.parse(commentText.trim())
}
