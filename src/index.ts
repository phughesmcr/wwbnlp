import definitions from "../data/models.json" with { type: "json" };
import {
  type Analysis,
  createLexicon,
  type Input,
  type Lexicon,
  type LexiconDefinition,
  type Options,
  score,
} from "./core.ts";
export * from "./core.ts";
export type ModelId =
  | "affect"
  | "age"
  | "gender"
  | "temporal"
  | "perma"
  | "permaEs"
  | "bigFive"
  | "darkTriad"
  | "optimism";
/** Immutable model definitions, including weights and research intercepts. */
export const models: Readonly<Record<ModelId, Lexicon>> = Object.freeze(
  Object.fromEntries(
    Object.entries(definitions).map((
      [id, definition],
    ) => [id, createLexicon(definition as LexiconDefinition)]),
  ) as Record<ModelId, Lexicon>,
);
/** Select a bundled research lexicon or supply a validated custom lexicon. */
export function analyse(
  input: Input,
  model: ModelId | Lexicon,
  options: Options = {},
): Analysis {
  const lexicon = typeof model === "string"
    ? Object.prototype.hasOwnProperty.call(models, model)
      ? models[model]
      : undefined
    : model;
  if (!lexicon) throw new RangeError(`Unknown model: ${String(model)}`);
  return score(input, lexicon, options);
}
