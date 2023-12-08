import { FileSystem, Path } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  clean: true,
  noExternal: ["effect"],
  onSuccess() {
    const program = Effect.gen(function*(_) {
      const fs = yield* _(FileSystem.FileSystem)
      const path = yield* _(Path.Path)
      const json = yield* _(fs.readFileString("package.json"), Effect.map(JSON.parse))
      const pkg = {
        name: json.name,
        version: json.version,
        description: json.description,
        main: "index.cjs",
        repository: json.repository,
        author: json.author,
        license: json.license,
        bugs: json.bugs,
        homepage: json.homepage,
        tags: json.tags,
        keywords: json.keywords
      }
      yield* _(fs.writeFileString(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2)))
    }).pipe(
      Effect.provide(Layer.merge(FileSystem.layer, Path.layerPosix))
    )

    return Effect.runPromise(program)
  }
})
