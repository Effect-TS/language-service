/// <reference types="vitest" />
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  plugins: [],
  test: {
    include: ["./test/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["./test/utils/**/*.ts", "./test/**/*.init.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@effect/language-service/test": path.resolve(__dirname, "/test"),
      "@effect/language-service": path.resolve(__dirname, "/src")
    }
  }
})
