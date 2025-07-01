import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LS from "@effect/language-service/init"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { applyEdits, createServicesWithMockedVFS } from "./utils/mocks.js"

const userPreferences: ts.UserPreferences & Record<string, unknown> = {
  "providePrefixAndSuffixTextForRename": true,
  "allowRenameOfImportPath": true,
  "includePackageJsonAutoImports": "auto",
  "excludeLibrarySymbolsInNavTo": true,
  "quotePreference": "auto",
  "importModuleSpecifierPreference": "non-relative",
  "importModuleSpecifierEnding": "auto",
  "jsxAttributeCompletionStyle": "auto",
  "allowTextChangesInNewFiles": true,
  "includeAutomaticOptionalChainCompletions": true,
  "provideRefactorNotApplicableReason": true,
  "generateReturnInDocTemplate": true,
  "includeCompletionsForImportStatements": true,
  "includeCompletionsWithSnippetText": true,
  "includeCompletionsWithClassMemberSnippets": true,
  "includeCompletionsWithObjectLiteralMethodSnippets": true,
  "autoImportFileExcludePatterns": [],
  "autoImportSpecifierExcludeRegexes": [],
  "preferTypeOnlyAutoImports": false,
  "useLabelDetailsInCompletionEntries": true,
  "allowIncompleteCompletions": true,
  "displayPartsForJSDoc": true,
  "disableLineTextInReferences": true,
  "interactiveInlayHints": true,
  "includeCompletionsForModuleExports": true,
  "includeInlayParameterNameHints": "none",
  "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
  "includeInlayFunctionParameterTypeHints": false,
  "includeInlayVariableTypeHints": false,
  "includeInlayVariableTypeHintsWhenTypeMatchesName": false,
  "includeInlayPropertyDeclarationTypeHints": false,
  "includeInlayFunctionLikeReturnTypeHints": false,
  "includeInlayEnumMemberValueHints": false,
  "organizeImportsIgnoreCase": "auto",
  "maximumHoverLength": 500,
  "triggerKind": 1,
  "includeExternalModuleExports": true,
  "includeInsertTextCompletions": true
}

interface E2ETestCompletions {
  type: "completions"
  position: string
  name: string
}

async function testCompletionOnExample(
  fileName: string,
  sourceText: string,
  testConfig: E2ETestCompletions
) {
  if (testConfig.type !== "completions") throw new Error("Not implemented")

  const { getLastLoadTime, languageService, languageServiceHost, program, sourceFile } = createServicesWithMockedVFS(
    fileName,
    sourceText
  )

  const config = LanguageServicePluginOptions.parse({})
  const project = {
    log: () => {}
  }
  const effectLanguageService = LS.init({ typescript: ts }).create(
    { languageService, languageServiceHost, config, project } as any
  )

  while (getLastLoadTime().getTime() > Date.now() - 200) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const [line, character] = testConfig.position.split(":")
  const position = ts.getPositionOfLineAndCharacter(sourceFile, +line! - 1, +character! - 1)

  const completions = effectLanguageService.getCompletionsAtPosition(
    sourceFile.fileName,
    position,
    userPreferences,
    ts.getDefaultFormatCodeSettings("\n")
  )

  const testCompletions = completions?.entries.filter((c) => c.name === testConfig.name) || []

  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "e2e",
    fileName + ".completions"
  )
  const snapshotEntries = testCompletions.map((_) => ({ name: _.name, source: _.source, sourceText: _.sourceText }))
  await expect(snapshotEntries).toMatchFileSnapshot(snapshotFilePath)

  const snapshotFilePathEntry = path.join(
    __dirname,
    "__snapshots__",
    "e2e",
    fileName + ".details"
  )

  let detailsText = ""

  for (const entry of (testCompletions || [])) {
    detailsText += "// '" + entry.name + "' from " + entry.source + "\n"
    const details = effectLanguageService.getCompletionEntryDetails(
      sourceFile.fileName,
      position,
      entry.name,
      ts.getDefaultFormatCodeSettings("\n"),
      sourceText,
      userPreferences,
      entry.data
    )
    for (const codeAction of (details?.codeActions || [])) {
      detailsText += "// code action " + codeAction.description + ":\n" +
        applyEdits(codeAction.changes, sourceFile.fileName, sourceText) +
        "\n"
    }
  }

  await expect(detailsText).toMatchFileSnapshot(snapshotFilePathEntry)

  expect(true).toBe(true)
}

function testAllCompletions() {
  describe("E2E", () => {
    const examplesE2EDir = path.join(__dirname, "..", "examples", "e2e")
    // read all filenames
    const allExampleFiles = fs.readdirSync(examplesE2EDir)
    for (const fileName of allExampleFiles) {
      // first we extract from the first comment line all the positions where the refactor has to be tested
      const sourceWithMarker = fs.readFileSync(path.join(examplesE2EDir, fileName))
        .toString("utf8")
      const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
      if (!firstLine.startsWith("//")) {
        throw new Error("First line of " + fileName + " must start with //")
      }
      const config = JSON.parse(firstLine.substring(2).trim())

      it.only(fileName + " at " + JSON.stringify(config), () => {
        // create the language service
        const sourceText = "// Result of running e2e " + JSON.stringify(config) +
          sourceWithMarker.substring(firstLine.length)
        return testCompletionOnExample(fileName, sourceText, config)
      })
    }
  })
}

testAllCompletions()
