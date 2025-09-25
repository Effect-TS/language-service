import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/transform.ts", "src/cli.ts", "src/effect-lsp-patch-utils.ts"],
  clean: true,
  sourcemap: true,
  noExternal: ["effect"],
  external: ["typescript"],
  onSuccess() {
    const program = Effect.gen(function*() {
      const fs = yield* (FileSystem.FileSystem)
      const path = yield* (Path.Path)

      // copy over readme.md
      const readme = yield* (fs.readFileString("README.md"))
      yield* (fs.writeFileString(path.join("dist", "README.md"), readme))

      // copy over license
      const license = yield* (fs.readFileString("LICENSE"))
      yield* (fs.writeFileString(path.join("dist", "LICENSE"), license))

      // generate package.json
      const json = yield* (fs.readFileString("package.json").pipe(Effect.map(JSON.parse)))
      const pkg = {
        name: json.name,
        version: json.version,
        description: json.description,
        main: "index.cjs",
        bin: {
          "effect-language-service": "cli.js"
        },
        repository: json.repository,
        author: json.author,
        license: json.license,
        bugs: json.bugs,
        homepage: json.homepage,
        tags: json.tags,
        keywords: json.keywords
      }
      yield* (fs.writeFileString(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2)))
    }).pipe(
      Effect.provide(Layer.merge(NodeFileSystem.layer, NodePath.layerPosix))
    )

    return Effect.runPromise(program)
  }
})
