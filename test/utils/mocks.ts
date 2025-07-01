import * as fs from "fs"
import * as ts from "typescript"

export function createMockLanguageServiceHost(
  fileName: string,
  sourceText: string
) {
  let lastLoadTime = new Date()
  const languageServiceHost: ts.LanguageServiceHost = {
    getCompilationSettings() {
      return {
        ...ts.getDefaultCompilerOptions(),
        strict: true,
        target: ts.ScriptTarget.ESNext,
        noEmit: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        paths: {
          "@/*": ["./examples/*"]
        }
      }
    },
    getScriptFileNames() {
      return [fileName]
    },
    getScriptVersion(_fileName) {
      return ""
    },
    getScriptSnapshot(_fileName) {
      lastLoadTime = new Date()
      if (_fileName === fileName) {
        return ts.ScriptSnapshot.fromString(sourceText)
      }
      return ts.ScriptSnapshot.fromString(fs.readFileSync(_fileName).toString())
    },
    getCurrentDirectory: () => ".",
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFilePath(options)
    },
    fileExists: (_fileName) => {
      lastLoadTime = new Date()
      if (_fileName === fileName) return true
      return fs.existsSync(_fileName)
    },
    readFile: (_fileName) => {
      lastLoadTime = new Date()
      if (_fileName === fileName) return sourceText
      return fs.readFileSync(_fileName).toString()
    }
  }

  return { languageServiceHost, getLastLoadTime: () => lastLoadTime }
}

export function createServicesWithMockedVFS(
  fileName: string,
  sourceText: string
) {
  const { getLastLoadTime, languageServiceHost } = createMockLanguageServiceHost(fileName, sourceText)
  const languageService = ts.createLanguageService(
    languageServiceHost,
    undefined,
    ts.LanguageServiceMode.Semantic
  )
  const program = languageService.getProgram()
  if (!program) throw new Error("No typescript program!")
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) throw new Error("No source file " + fileName + " in VFS")

  return { languageService, program, sourceFile, languageServiceHost, getLastLoadTime }
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
