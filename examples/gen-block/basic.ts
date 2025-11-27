/**
 * Basic gen-block example
 *
 * Demonstrates simple bind operations with Effect shorthand imports.
 */
import * as Effect from "effect/Effect"
import { succeed, tryPromise, fail } from "effect/Effect"

// Simple service functions using shorthand
const getUser = (id: string) => succeed({ id, name: "Alice" })
const getSettings = (userId: string) => succeed({ userId, theme: "dark" })
const fetchFromApi = (url: string) => tryPromise(() => fetch(url).then(r => r.json()))

// Basic gen-block usage
export const basicProgram = gen {
  user <- getUser("123")
  settings <- getSettings(user.id)
  return { user, settings }
}

// With const bindings
export const withConstBindings = gen {
  user <- getUser("abc")
  const upperName = user.name.toUpperCase()
  const greeting = `Hello, ${upperName}!`
  return { user, greeting }
}

// Using tryPromise for async operations
export const withTryPromise = gen {
  data <- tryPromise(() => fetch("https://api.example.com/users").then(r => r.json()))
  return data
}

// Multiple binds in sequence
export const sequentialBinds = gen {
  a <- succeed(1)
  b <- succeed(2)
  c <- succeed(3)
  return a + b + c
}
