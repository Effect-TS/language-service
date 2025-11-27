/**
 * Advanced gen-block examples
 *
 * Demonstrates control flow, nested structures, and error handling.
 */
import * as Effect from "effect/Effect"
import { succeed, fail, tryPromise, catchAll, map, flatMap } from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"

// Service layer
interface User { id: string; name: string; email: string }
interface Profile { userId: string; bio: string; avatar: string }

const findUser = (id: string) => succeed<User>({ id, name: "Alice", email: "alice@example.com" })
const findProfile = (userId: string) => succeed<Profile>({ userId, bio: "Developer", avatar: "/alice.png" })
const sendEmail = (to: string, subject: string) => succeed({ sent: true, to, subject })

// Sequential gen-blocks
export const sequentialEffects = gen {
  user <- findUser("123")
  profile <- findProfile(user.id)
  const enriched = { ...profile, displayName: user.name }
  return { user, profile: enriched }
}

// Control flow with if/else (using standard Effect patterns)
export const withControlFlow = gen {
  user <- findUser("456")
  notification <- sendEmail(user.email, "Welcome!")
  return { user, notified: true }
}

// Error handling pattern
const riskyOperation = () => tryPromise({
  try: () => Promise.resolve("success"),
  catch: (error) => new Error(`Failed: ${error}`)
})

export const withErrorHandling = gen {
  result <- pipe(
    riskyOperation(),
    catchAll((error) => succeed(`recovered from: ${error.message}`))
  )
  return { result }
}

// Working with Option
const maybeUser = (id: string) => succeed(Option.some({ id, name: "Bob" }))

export const withOption = gen {
  optUser <- maybeUser("789")
  const userName = pipe(optUser, Option.getOrElse(() => ({ id: "default", name: "Guest" }))).name
  return { userName }
}

// Complex pipeline with gen-block
export const complexPipeline = gen {
  user <- findUser("abc")
  profile <- findProfile(user.id)
  
  // Multiple operations
  const fullName = user.name.toUpperCase()
  const summary = `${fullName} - ${profile.bio}`
  
  // Another effect
  notification <- sendEmail(user.email, `Profile Summary: ${summary}`)
  
  return {
    user,
    profile,
    summary,
    notification
  }
}
