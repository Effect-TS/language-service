import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
  resolve: {
    alias: {
      "@effect/language-service/test": path.join(__dirname, "test"),
      "@effect/language-service": path.join(__dirname, "src")
    }
  }
})
