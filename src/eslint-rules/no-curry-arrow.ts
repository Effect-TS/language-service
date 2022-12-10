import * as utils from "@effect/language-service/eslint-rules/utils"
import * as AST from "@effect/language-service/utils/AST"
import * as ts from "typescript/lib/tsserverlibrary"

export default utils.createRule({
  create(context) {
    const parserServices = utils.getParserServices(context)

    return {
      ArrowFunctionExpression(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node)
        if (AST.isCurryArrow(ts)(tsNode)) {
          context.report({
            messageId: "noCurryArrow",
            node
          })
        }
      }
    }
  },
  name: "no-curry-arrow",
  meta: {
    docs: {
      description: "There should be no curry arrow functions, like T.map((_) => log(_)) should be T.map(log) instead",
      recommended: "warn"
    },
    messages: {
      noCurryArrow: "There should be no curry arrow functions, like T.map((_) => log(_)) should be T.map(log) instead"
    },
    type: "suggestion",
    schema: []
  },
  defaultOptions: []
})
