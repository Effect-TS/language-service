import type { RefactorDefinition } from "@effect/language-service/definition"
import { refactors } from "@effect/language-service/refactors"
import * as O from "effect/Option"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createMockLanguageServiceHost } from "./utils/MockLanguageServiceHost.js"

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

function applyEdits(
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

const getExamplesRefactorsDir = () => path.join(__dirname, "..", "examples", "refactors")

function testRefactorOnExample(refactor: RefactorDefinition, fileName: string) {
  const sourceWithMarker = fs.readFileSync(path.join(getExamplesRefactorsDir(), fileName))
    .toString("utf8")
  const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
  for (const [textRangeString] of firstLine.matchAll(/([0-9]+:[0-9]+(-[0-9]+:[0-9]+)*)/gm)) {
    it(fileName + " at " + textRangeString, () => {
      // create the language service
      const sourceText = "// Result of running refactor " + refactor.name +
        " at position " + textRangeString + sourceWithMarker.substring(firstLine.length)
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

      // gets the position to test
      let startPos = 0
      let endPos = 0
      let i = 0
      for (const lineAndCol of textRangeString.split("-")) {
        const [line, character] = lineAndCol.split(":")
        const pos = ts.getPositionOfLineAndCharacter(sourceFile, +line! - 1, +character! - 1)
        if (i === 0) startPos = pos
        if (i === 1) endPos = pos
        i += 1
      }
      if (endPos < startPos) endPos = startPos
      const textRange = { pos: startPos, end: endPos }

      // ensure there are no errors in TS file
      const diagnostics = languageService.getCompilerOptionsDiagnostics()
        .concat(languageService.getSyntacticDiagnostics(fileName))
        .concat(languageService.getSemanticDiagnostics(fileName)).map((diagnostic) => {
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          if (diagnostic.file) {
            const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start!
            )
            return `  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
          } else {
            return `  Error: ${message}`
          }
        })
      expect(diagnostics).toEqual([])

      // check and assert the refactor is executable
      const canApply = refactor.apply(ts, program, { diagnostics: false, quickinfo: false })(
        sourceFile,
        textRange
      )

      if (O.isNone(canApply)) {
        expect(sourceText).toMatchSnapshot()
        return
      }

      // run the refactor and ensure it matches the snapshot
      const formatContext = ts.formatting.getFormatContext(
        ts.getDefaultFormatCodeSettings("\n"),
        { getNewLine: () => "\n" }
      )
      const edits = ts.textChanges.ChangeTracker.with(
        {
          formatContext,
          host: languageServiceHost,
          preferences: {}
        },
        (changeTracker) => canApply.value.apply(changeTracker)
      )

      expect(applyEdits(edits, fileName, sourceText)).toMatchSnapshot()
    })
  }
}

function testFiles(refactor: RefactorDefinition, fileNames: Array<string>) {
  for (const fileName of fileNames) {
    describe(fileName, () => {
      testRefactorOnExample(refactor, fileName)
    })
  }
}

function getExampleFileNames(refactorName: string): Array<string> {
  return fs.readdirSync(getExamplesRefactorsDir())
    .filter((fileName) =>
      fileName === refactorName + ".ts" ||
      fileName.startsWith(refactorName + "_") && fileName.endsWith(".ts")
    )
}

Object.keys(refactors).map((refactorName) =>
  // @ts-expect-error
  testFiles(refactors[refactorName], getExampleFileNames(refactorName))
)
