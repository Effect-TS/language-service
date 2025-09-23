import { constFalse, constTrue, constUndefined, constVoid } from "effect/Function"
import type * as ts from "typescript"

const fakeFileWatcher: ts.FileWatcher = {
  close: constVoid
}
export function createProjectService(
  _defaultProject?: string
) {
  const defaultProject = _defaultProject || "tsconfig.json"
  let diagnostics: Array<ts.Diagnostic> = []

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tsserver = require("typescript/lib/tsserverlibrary") as typeof ts

  const host: ts.server.ServerHost = {
    ...tsserver.sys,
    clearImmediate,
    clearTimeout,
    setImmediate,
    setTimeout,
    watchDirectory: () => fakeFileWatcher,
    watchFile: () => fakeFileWatcher,
    getCurrentDirectory: () => process.cwd()
  }

  console.log("host", host.getCurrentDirectory())

  const logger: ts.server.Logger = {
    close: constVoid,
    getLogFileName: constUndefined,
    loggingEnabled: constTrue,
    hasLevel: constTrue,
    msg: (s, type) => console.log(type, s),
    info(s) {
      this.msg(s, tsserver.server.Msg.Info)
    },
    perftrc(s) {
      this.msg(s, tsserver.server.Msg.Perf)
    },
    startGroup: constVoid,
    endGroup: constVoid
  }

  const cancellationToken: ts.HostCancellationToken = { isCancellationRequested: constFalse }

  const service = new tsserver.server.ProjectService({
    host,
    logger,
    cancellationToken,
    session: undefined,
    useInferredProjectPerProjectRoot: false,
    useSingleInferredProject: false,
    // disable any kind of plugin loading
    globalPlugins: [],
    allowLocalPluginLoads: false
  })

  const configForExternalFiles = tsserver.getParsedCommandLineOfConfigFile(
    defaultProject,
    {
      noEmit: true // we don't change files, but just as security measure
    },
    {
      ...tsserver.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
    }
  )

  if (configForExternalFiles) {
    diagnostics = [...diagnostics, ...configForExternalFiles.errors]
    service.setCompilerOptionsForInferredProjects(
      // https://github.com/microsoft/TypeScript/blob/27bcd4cb5a98bce46c9cdd749752703ead021a4b/src/server/protocol.ts#L1904
      configForExternalFiles.options as ts.server.protocol.InferredProjectCompilerOptions
    )
  }

  return { service, diagnostics }
}

export function getSourceFileAndProgram(projectService: ts.server.ProjectService, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tsserver = require("typescript/lib/tsserverlibrary") as typeof ts
  const normalizedPath = tsserver.server.toNormalizedPath(path)
  const scriptInfo = projectService.getScriptInfoForNormalizedPath(normalizedPath)
  if (scriptInfo) {
    const targetProject = scriptInfo.getDefaultProject()
    if (targetProject) {
      const program = targetProject.getLanguageService().getProgram()
      if (program) {
        const sourceFile = targetProject.getSourceFile(scriptInfo.path)
        if (sourceFile) {
          return ({
            program,
            sourceFile
          })
        }
      }
    }
  }
}

export function getOrCreateSourceFileAndProgram(projectService: ts.server.ProjectService, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tsserver = require("typescript/lib/tsserverlibrary") as typeof ts
  const normalizedPath = tsserver.server.toNormalizedPath(path)
  const openedProject = projectService.openClientFile(normalizedPath)
  console.log("openedProject", openedProject)
  // eslint-disable-next-line no-constant-condition
  if (true) {
    const targetProject = projectService.getDefaultProjectForFile(process.cwd() + "/src/index.ts" as any, true)
    if (targetProject) {
      console.log("targetProject", targetProject)
      const program = targetProject.getLanguageService().getProgram()
      if (program) {
        console.log(program.getSourceFiles().map((_) => _.fileName))
        const sourceFile = program.getSourceFileByPath(projectService.toPath(path))
        if (sourceFile) {
          console.log("sourceFile", sourceFile)
          return ({
            program,
            sourceFile
          })
        }
      }
    }
  }
}
