import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import type { RefactorDefinition } from "@effect/language-service/refactors/definition"
import refactors from "@effect/language-service/refactors/index"
import { createMockLanguageServiceHost } from "@effect/language-service/test/utils"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"
import * as fs from "fs"
import ts from "typescript/lib/tsserverlibrary"

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

function applyEdits(edits: ReadonlyArray<ts.FileTextChanges>, fileName: string, sourceText: string): string {
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

export function testRefactorOnExample(refactor: RefactorDefinition, fileName: string) {
  const sourceWithMarker = fs.readFileSync(require.resolve(__dirname + "/../examples/refactors/" + fileName))
    .toString("utf8")
  const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
  for (const [textRangeString] of firstLine.matchAll(/([0-9]+:[0-9]+(-[0-9]+:[0-9]+)*)/gm)) {
    it(fileName + " at " + textRangeString, () => {
      // create the language service
      const sourceText = "// Result of running refactor " + refactor.name +
        " at position " + textRangeString + sourceWithMarker.substring(firstLine.length)
      const languageServiceHost = createMockLanguageServiceHost(fileName, sourceText)
      const languageService = ts.createLanguageService(languageServiceHost, undefined, ts.LanguageServiceMode.Semantic)
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
            const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
            return `  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
          } else {
            return `  Error: ${message}`
          }
        })
      expect(diagnostics).toEqual([])

      // check and assert the refactor is executable
      const canApply = pipe(
        refactor.apply(sourceFile, textRange),
        T.provideService(AST.TypeScriptApi, ts),
        T.provideService(AST.TypeScriptProgram, program),
        T.unsafeRunSync
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
        (changeTracker) =>
          pipe(
            canApply.value.apply,
            T.provideService(AST.ChangeTrackerApi, changeTracker),
            T.provideService(AST.TypeScriptApi, ts),
            T.provideService(AST.TypeScriptProgram, program),
            T.unsafeRunSync
          )
      )

      expect(applyEdits(edits, fileName, sourceText)).toMatchSnapshot()
    })
  }
}

function testFiles(name: string, refactor: RefactorDefinition, fileNames: Array<string>) {
  for (const fileName of fileNames) {
    describe(fileName, () => {
      testRefactorOnExample(refactor, fileName)
    })
  }
}

Object.keys(refactors).map((refactorName) => testFiles(refactorName, refactors[refactorName]!, [refactorName + ".ts"]))
