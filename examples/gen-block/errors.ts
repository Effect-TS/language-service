/**
 * Gen-block error examples
 *
 * This file contains intentional type errors to test error detection.
 * The check command should report these errors with correct positions.
 */
import * as Effect from "effect/Effect"
import { succeed, fail, tryPromise } from "effect/Effect"

interface User { id: string; name: string }
const getUser = (id: string) => succeed<User>({ id, name: "Test" })
const processAge = (age: number) => succeed(age * 2)

// Error: passing number instead of string
export const wrongArgumentType = gen {
  user <- getUser(123) // Error: number is not assignable to string
  return user
}

// Error: accessing non-existent property
export const missingProperty = gen {
  user <- getUser("abc")
  const email = user.email // Error: Property 'email' does not exist on type 'User'
  return email
}

// Error: wrong return type
export const wrongReturnType = gen {
  user <- getUser("def")
  return user.name.toFixed(2) // Error: toFixed does not exist on string
}

// Error: incompatible bind
export const incompatibleBind = gen {
  age <- processAge("not a number") // Error: string is not assignable to number
  return age
}
