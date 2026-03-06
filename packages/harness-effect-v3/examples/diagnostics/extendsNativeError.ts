// @effect-diagnostics extendsNativeError:warning

// Flagged: direct extends Error
class MyError extends Error {}

// Flagged: via alias
const E = Error
class MyError2 extends E {}

// Not flagged: indirect (extends a subclass of Error)
class Base extends Error {}
class MyError3 extends Base {}

// Not flagged: unrelated class
class Bar {}
class Foo extends Bar {}
