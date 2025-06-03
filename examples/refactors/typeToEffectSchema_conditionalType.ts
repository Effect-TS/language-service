// 3:15

export type Test = { a: string } extends Record<string, infer T> ? T : never
