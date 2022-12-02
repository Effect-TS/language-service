/* eslint-disable @repo-tooling/dprint/dprint */
import { ESLintUtils } from "@typescript-eslint/utils"

const {getParserServices} = ESLintUtils

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
)

export { getParserServices, createRule}
