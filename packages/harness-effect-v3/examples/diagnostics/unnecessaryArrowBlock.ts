// @effect-diagnostics unnecessaryArrowBlock:warning
export const shouldReport = (arg: string) => {
  return arg.trim()
}

export const shouldReportParens = (arg: string) => {
  return arg + "!"
}

export const shouldNotReportMultipleStatements = (arg: string) => {
  const trimmed = arg.trim()
  return trimmed
}

export const shouldReportObjectLiteral = (arg: string) => {
  return { arg }
}

export const shouldNotReportExpressionBody = (arg: string) => arg.trim()
