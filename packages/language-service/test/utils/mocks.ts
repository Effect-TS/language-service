import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { getExamplesDir, getHarnessDir } from "./harness.js"

export function createMockLanguageServiceHost(
  fileName: string,
  sourceText: string
): ts.LanguageServiceHost {
  const examplesDir = getExamplesDir()
  const harnessDir = getHarnessDir()
  const realPath = (fileName: string) => path.resolve(harnessDir, fileName)

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
      if (_fileName === fileName) {
        return ts.ScriptSnapshot.fromString(sourceText)
      }
      return ts.ScriptSnapshot.fromString(fs.readFileSync(realPath(_fileName)).toString())
    },
    getCurrentDirectory: () => ".",
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFilePath(options)
    },
    fileExists: (_fileName) => {
      if (_fileName === fileName) return true
      return fs.existsSync(realPath(_fileName))
    },
    readFile: (_fileName) => {
      if (_fileName === fileName) return sourceText
      return fs.readFileSync(realPath(_fileName)).toString()
    }
  }
}

export function createServicesWithMockedVFS(
  fileName: string,
  sourceText: string
) {
  const languageServiceHost = createMockLanguageServiceHost(fileName, sourceText)
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
