import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import { pipe } from "effect"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import { extractAppliedEffectLspPatches, getModuleFilePath, getPackageJsonData, TypeScriptContext } from "./utils"

const LOCAL_TYPESCRIPT_DIR = "./node_modules/typescript"

const dirPath = Options.directory("dir").pipe(
  Options.withDefault(LOCAL_TYPESCRIPT_DIR),
  Options.withDescription("The directory of the typescript package to patch.")
)

export const check = Command.make(
  "check",
  { dirPath },
  Effect.fn("check")(function*({ dirPath }) {
    const fs = yield* FileSystem.FileSystem
    const ts = yield* TypeScriptContext

    // read my data
    const { version: effectLspVersion } = yield* getPackageJsonData(__dirname)
    yield* Effect.logDebug(`Found @effect/language-service version ${effectLspVersion}!`)

    // search for typescript
    yield* Effect.logDebug(`Searching for typescript in ${dirPath}...`)
    const { version: typescriptVersion } = yield* getPackageJsonData(dirPath)
    yield* Effect.logDebug(`Found typescript version ${typescriptVersion}!`)

    for (const moduleName of ["typescript", "tsc"] as const) {
      // get the unpatched source file
      yield* Effect.logDebug(`Searching ${moduleName}...`)
      const filePath = yield* getModuleFilePath(dirPath, moduleName)

      yield* Effect.logDebug(`Reading ${moduleName} from ${filePath}...`)
      const sourceText = yield* fs.readFileString(filePath)
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true)

      // construct the patches to apply
      yield* Effect.logDebug(`Collecting patches for ${moduleName}...`)
      const { patches } = yield* extractAppliedEffectLspPatches(sourceFile)

      const patchesVersion = pipe(patches, Array.map((patch) => patch.version), Array.dedupe)

      if (patchesVersion.length === 0) {
        yield* Effect.logInfo(`${filePath} is not patched.`)
      } else {
        yield* Effect.logInfo(`${filePath} patched with version ${patchesVersion.join(", ")}`)
      }
    }
  })
).pipe(
  Command.withDescription("Check if the typescript package is patched with the effect-language-service.")
)
