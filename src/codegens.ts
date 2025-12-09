import { accessors } from "./codegens/accessors.js"
import { annotate } from "./codegens/annotate.js"
import { typeToSchema } from "./codegens/typeToSchema.js"

export const codegens = [accessors, annotate, typeToSchema]
