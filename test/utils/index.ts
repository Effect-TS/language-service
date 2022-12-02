import { ESLintUtils } from "@typescript-eslint/utils"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript/lib/tsserverlibrary"

export function createMockLanguageServiceHost(fileName: string, sourceText: string): ts.LanguageServiceHost {
  return {
    getCompilationSettings() {
      return {
        ...ts.getDefaultCompilerOptions(),
        strict: true,
        target: ts.ScriptTarget.ESNext,
        noEmit: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs
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
      return ts.ScriptSnapshot.fromString(fs.readFileSync(_fileName).toString())
    },
    getCurrentDirectory: () => ".",
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFilePath(options)
    },
    fileExists: (_fileName) => {
      if (_fileName === fileName) return true
      return fs.existsSync(_fileName)
    },
    readFile: (_fileName) => {
      if (_fileName === fileName) return sourceText
      return fs.readFileSync(_fileName).toString()
    }
  }
}

export const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: path.join(__dirname, "..", "fixtures")
  }
})
