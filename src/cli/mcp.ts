import * as Command from "@effect/cli/Command"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Effect from "effect/Effect"

export const mcp = Command.make(
  "mcp",
  {},
  Effect.fn("mcp")(function*() {
    const filePathAbsolute = process.cwd() + "/src/index.ts"
    const { service } = createProjectService()

    service.openClientFile(filePathAbsolute)

    const scriptInfo = service.getScriptInfo(filePathAbsolute)!
    const program = service
      .getDefaultProjectForFile(scriptInfo.fileName, true)!
      .getLanguageService(true)
      .getProgram()!
    console.log("program", program)
  })
)
