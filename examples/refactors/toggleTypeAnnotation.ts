// 4:16,5:16,8:16,11:16,12:16,14:16,15:16,20:16,24:16,38:16
import * as T from "@effect/io/Effect"

export const test1 = T.succeed
export const test2 = T.fail("LOL")

const predefined = 42
export const test3 = predefined

const callable = () => 42
export const test4 = callable
export const test5 = T.die

const removeAnnotation:number=42
const removeAnnotationWithSpace: number = 42

declare function withOverloads(a: 1): boolean
declare function withOverloads(a: 2): string

export const test6 = withOverloads

declare const functIntersection: ((a: 1) => boolean) & ((a: 2) => string)

export const test7 = functIntersection

declare const intersection1: {
    (a: 1): boolean
    (b: 2): string
}

declare const intersection2: {
    (a: 3): number
    (b: 4): bigint
}

declare function intersect<A, B>(a: A, b: B): A & B

export const test8 = intersect(intersection1, intersection2)
