import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import { codegens as codegensDefinitions } from "../codegens"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { applyTextChanges, extractEffectLspOptions, getFileNamesInTsConfig, getTypeScript } from "./utils"

export class NoFilesToCodegenError extends Data.TaggedError("NoFilesToCodegenError")<{}> {
  get message(): string {
    return "No files to codegen. Please provide an existing .ts file or a project tsconfig.json"
  }
}

const file = Options.file("file").pipe(
  Options.optional,
  Options.withDescription("The full path of the file to codegen.")
)

const project = Options.file("project").pipe(
  Options.optional,
  Options.withDescription("The full path of the project tsconfig.json file to codegen.")
)

const verbose = Options.boolean("verbose").pipe(
  Options.withDefault(false),
  Options.withDescription("Verbose output.")
)

const BATCH_SIZE = 50

export const codegen = Command.make(
  "codegen",
  { file, project, verbose },
  Effect.fn("codegen")(function*({ file, project, verbose }) {
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem
    const tsInstance = yield* getTypeScript
    let filesToCodegen = new Set<string>()
    let checkedFilesCount = 0
    let updatedFilesCount = 0

    // collect files involved
    if (Option.isSome(project)) {
      filesToCodegen = yield* getFileNamesInTsConfig(project.value)
    }
    if (Option.isSome(file)) {
      filesToCodegen.add(path.resolve(file.value))
    }
    if (filesToCodegen.size === 0) {
      return yield* new NoFilesToCodegenError()
    }

    // keep only files that have @effect-codegens
    const filesWithCodegenDirective = new Set<string>()
    for (const filePath of filesToCodegen) {
      const sourceText = yield* fs.readFileString(filePath)
      if (sourceText.toLowerCase().indexOf("@effect-codegens") !== -1) {
        filesWithCodegenDirective.add(filePath)
      }
    }
    if (filesWithCodegenDirective.size === 0) {
      return yield* new NoFilesToCodegenError()
    }

    const filesToCodegenArray = Array.fromIterable(filesWithCodegenDirective)
    const batches = Array.chunksOf(filesToCodegenArray, BATCH_SIZE)

    let lastLanguageService: ts.LanguageService | undefined
    const disposeIfLanguageServiceChanged = (languageService: ts.LanguageService | undefined) => {
      if (lastLanguageService !== languageService) {
        lastLanguageService?.dispose()
        lastLanguageService = languageService
      }
    }

    for (const batch of batches) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        service.openClientFile(filePath)
        try {
          const scriptInfo = service.getScriptInfo(filePath)
          if (!scriptInfo) continue

          const project = scriptInfo.getDefaultProject()
          const languageService = project.getLanguageService(true)
          disposeIfLanguageServiceChanged(languageService)
          const program = languageService.getProgram()
          if (!program) continue
          const sourceFile = program.getSourceFile(filePath)
          if (!sourceFile) continue
          const pluginConfig = extractEffectLspOptions(program.getCompilerOptions())
          if (!pluginConfig) continue

          const formatContext = tsInstance.formatting.getFormatContext(
            tsInstance.getDefaultFormatCodeSettings(project.getNewLine()),
            project
          )

          const allFileChanges = pipe(
            Nano.gen(function*() {
              let allChanges: Array<ts.FileTextChanges> = []
              const codegensWithRanges = yield* LSP.getCodegensForSourceFile(codegensDefinitions, sourceFile)
              for (const { codegen, hash, range } of codegensWithRanges) {
                const applicable = yield* pipe(
                  LSP.getEditsForCodegen([codegen], sourceFile, range),
                  Nano.orElse(() => Nano.void_)
                )
                if (applicable && applicable.hash !== hash) {
                  const changes = tsInstance.textChanges.ChangeTracker.with(
                    {
                      formatContext,
                      host: project,
                      preferences: {}
                    },
                    (changeTracker) =>
                      pipe(
                        applicable.apply,
                        Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
                        Nano.run
                      )
                  )
                  allChanges = [...allChanges, ...changes]
                }
              }
              return allChanges
            }),
            TypeParser.nanoLayer,
            TypeCheckerUtils.nanoLayer,
            TypeScriptUtils.nanoLayer,
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
            Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
            Nano.provideService(
              LanguageServicePluginOptions.LanguageServicePluginOptions,
              { ...LanguageServicePluginOptions.parse(pluginConfig), diagnosticsName: false }
            ),
            Nano.run,
            Either.getOrElse(() => [] as Array<ts.FileTextChanges>)
          )
          checkedFilesCount++

          // only changes to this file
          const thisFileChanges = allFileChanges.filter((change) => change.fileName === sourceFile.fileName)
          const flattenedChanges = Array.flatten(thisFileChanges.map((change) => change.textChanges))

          if (verbose) {
            if (flattenedChanges.length > 0) {
              console.log(`${filePath}: with ${flattenedChanges.length} changes`)
            } else {
              console.log(`${filePath}: no changes`)
            }
          }
          if (flattenedChanges.length === 0) continue

          // apply the changes
          const sourceText = yield* fs.readFileString(filePath)
          const newSourceText = yield* applyTextChanges(sourceText, flattenedChanges)
          yield* fs.writeFileString(filePath, newSourceText)
          updatedFilesCount++
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow()
    }
    disposeIfLanguageServiceChanged(undefined)

    console.log(
      `${filesToCodegen.size} involved files, of which ${filesWithCodegenDirective.size} with codegens.\n${checkedFilesCount} checked and ${updatedFilesCount} updated.`
    )
  })
)
