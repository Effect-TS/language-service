// eslint-disable-next-line @typescript-eslint/consistent-type-imports, no-undef
module.exports = function init(modules) {
  function create(info) {
    // start with regular language service, then load custom once async module has loaded
    let languageService = info.languageService
    import("./build/cjs/index.js").then(v => languageService = v.default(modules).create(info))

    // create the proxy
    const proxy = Object.create(null)
    for (const k of Object.keys(info.languageService)) {
      proxy[k] = (...args) => languageService[k].apply(languageService, args)
    }

    return proxy
  }

  return { create }
}
