import { Model } from "effect/unstable/schema"
import {Schema} from "effect"

// valid usage
export class ValidModelClass extends Model.Class<ValidModelClass>("ValidModelClass")({
  id: Schema.String
}) {}

// invalid usage: Model.Class<ValidModelClass> should be Model.Class<InvalidModelClass> because the Self type parameter is not the same as the class name
export class InvalidModelClass extends Model.Class<ValidModelClass>("InvalidModelClass")({
  id2: Schema.String
}) {}
