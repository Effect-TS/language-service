import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { diagnostics as diagnosticsDefinitions } from "../diagnostics"
import { getTypeScript } from "./utils"

export class NoFilesToCheckError extends Data.TaggedError("NoFilesToCheckError")<{}> {
  get message(): string {
    return "No files to check. Please provide an existing .ts file or a project tsconfig.json"
  }
}

const file = Options.file("file").pipe(
  Options.optional,
  Options.withDescription("The full path of the file to check for diagnostics.")
)

const project = Options.file("project").pipe(
  Options.optional,
  Options.withDescription("The full path of the project tsconfig.json file to check for diagnostics.")
)

const extractEffectLspOptions = (compilerOptions: ts.CompilerOptions) => {
  return (Predicate.hasProperty(compilerOptions, "plugins") && Array.isArray(compilerOptions.plugins)
    ? compilerOptions.plugins
    : []).find((_) => Predicate.hasProperty(_, "name") && _.name === "@effect/language-service")
}

export const diagnostics = Command.make(
  "diagnostics",
  { file, project },
  Effect.fn("diagnostics")(function*({ file, project }) {
    const path = yield* Path.Path
    const tsInstance = yield* getTypeScript
    const filesToCheck = new Set<string>()
    let checkedFilesCount = 0
    let errorsCount = 0
    let warningsCount = 0
    let messagesCount = 0

    const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

    if (Option.isSome(file)) {
      filesToCheck.add(path.resolve(file.value))
    }

    if (Option.isSome(project)) {
      let tsconfigToHandle = [project.value ?? ""]
      while (tsconfigToHandle.length > 0) {
        const tsconfigPath = tsconfigToHandle.shift()!
        const tsconfigAbsolutePath = path.resolve(tsconfigPath)
        // process the project references, which may be a folder with a contained tsconfig.json file
        const configFile = tsInstance.readConfigFile(tsconfigAbsolutePath, tsInstance.sys.readFile)
        if (configFile.error && !tsconfigAbsolutePath.endsWith("tsconfig.json")) {
          tsconfigToHandle = [...tsconfigToHandle, path.resolve(tsconfigPath, "tsconfig.json")]
          continue
        }
        // parse the config file
        const parsedConfig = tsInstance.parseJsonConfigFileContent(
          configFile.config,
          tsInstance.sys,
          path.dirname(tsconfigAbsolutePath)
        )
        tsconfigToHandle = [...tsconfigToHandle, ...parsedConfig.projectReferences?.map((_) => _.path) ?? []]
        parsedConfig.fileNames.forEach((_) => filesToCheck.add(_))
      }
    }

    if (filesToCheck.size === 0) {
      return yield* new NoFilesToCheckError()
    }

    for (const filePath of filesToCheck) {
      service.openClientFile(filePath)
      try {
        const scriptInfo = service.getScriptInfo(filePath)
        if (!scriptInfo) continue

        const project = scriptInfo.getDefaultProject()
        const languageService = project.getLanguageService(true)
        const program = languageService.getProgram()
        if (!program) continue
        const sourceFile = program.getSourceFile(filePath)
        if (!sourceFile) continue
        const pluginConfig = extractEffectLspOptions(program.getCompilerOptions())
        if (!pluginConfig) continue

        // run the diagnostics and pipe them into addDiagnostic
        const results = pipe(
          LSP.getSemanticDiagnosticsWithCodeFixes(diagnosticsDefinitions, sourceFile),
          TypeParser.nanoLayer,
          TypeCheckerUtils.nanoLayer,
          TypeScriptUtils.nanoLayer,
          Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
          Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
          Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
          Nano.provideService(
            LanguageServicePluginOptions.LanguageServicePluginOptions,
            LanguageServicePluginOptions.parse(pluginConfig)
          ),
          Nano.run,
          Either.map((_) => _.diagnostics),
          Either.map(
            Array.map((_) =>
              _.category === tsInstance.DiagnosticCategory.Suggestion
                ? { ..._, category: tsInstance.DiagnosticCategory.Message }
                : _
            )
          ),
          Either.getOrElse(() => [])
        )
        checkedFilesCount++
        errorsCount += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Error).length
        warningsCount += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Warning).length
        messagesCount += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Message).length
        if (results.length === 0) continue
        // pretty print the results
        const formattedResults = tsInstance.formatDiagnosticsWithColorAndContext(results, {
          getCanonicalFileName: (fileName) => path.resolve(fileName),
          getCurrentDirectory: () => path.resolve("."),
          getNewLine: () => "\n"
        })
        console.log(formattedResults)
      } finally {
        service.closeClientFile(filePath)
      }
      yield* Effect.yieldNow()
    }
    console.log(
      `Checked ${checkedFilesCount} files out of ${filesToCheck.size} files. \n${errorsCount} errors, ${warningsCount} warnings and ${messagesCount} messages.`
    )
  })
)
