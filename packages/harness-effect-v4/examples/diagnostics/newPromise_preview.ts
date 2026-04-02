// @effect-diagnostics *:off
// @effect-diagnostics newPromise:warning

export const preview = new Promise<number>((resolve) => resolve(1))
