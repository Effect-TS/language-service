// @effect-diagnostics *:off
// @effect-diagnostics asyncFunction:warning

export const preview = async () => {
  await Promise.resolve(1)
}
