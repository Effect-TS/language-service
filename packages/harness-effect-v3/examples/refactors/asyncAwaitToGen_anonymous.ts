// 4:44,13:41
import * as Effect from "effect/Effect"

const asyncFunctionDeclaration = async function() {
  const response = await fetch("test")
  if (response.ok) {
    const y = await response.json()
    return y
  }
  return null
}

const asyncArrowFunctionExpression = async () => {
  const response = await fetch("test")
  if (response.ok) {
    const y = await response.json()
    return y
  }
  return null
}
