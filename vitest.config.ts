/// <reference types="vitest" />
import * as path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  test: {
    include: ["packages/*/build/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    resolveSnapshotPath(filePath, snapExt) {
      const { dir } = path.parse(filePath)
      return dir + "/../../test/" + path.basename(filePath) + snapExt
    }
  }
})
