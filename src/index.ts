import definitions from "../data/models.json" with { type: "json" };
import {
  type Analysis,
  createLexicon,
  type Input,
  type Lexicon,
  type LexiconDefinition,
  type Options,
  score,
  tokenize,
  type Tokens,
} from "./core.ts";
export * from "./core.ts";
/** Bundled weighted lexica. */
export type LexiconId =
  | "affect"
  | "age"
  | "gender"
  | "temporal"
  | "perma"
  | "permaEs"
  | "bigFive"
  | "darkTriad";
/** Bundled lexica plus `optimism`, which combines temporal and affect. */
export type ModelId = LexiconId | "optimism";
/** Immutable lexicon definitions, including weights and research intercepts. */
export const models: Readonly<Record<LexiconId, Lexicon>> = Object.freeze(
  Object.fromEntries(
    Object.entries(definitions).map((
      [id, definition],
    ) => [id, createLexicon(definition as LexiconDefinition)]),
  ) as Record<LexiconId, Lexicon>,
);
/**
 * WWBP's optimism procedure: "filter messages to those future-oriented using
 * the future orientation lexicon, then apply the affect lexicon". A message is
 * future-oriented when FUTURE is its highest temporal score. OPTIMISM is the
 * mean valence of those messages; options apply to the affect step.
 */
function optimism(input: Input, options: Options): Analysis {
  if (options && typeof options === "object" && "aggregation" in options) {
    throw new RangeError("optimism does not accept an aggregation option");
  }
  const messages: readonly Tokens[] = typeof input === "string"
    ? [tokenize(input)]
    : Array.isArray(input) && input.length > 0 &&
        input.every((m) => Array.isArray(m))
    ? input as readonly Tokens[]
    : [input as Tokens];
  const temporal = score(messages, models.temporal);
  const future = temporal.messageValues.map((v) =>
    v.FUTURE != null &&
    v.FUTURE === Math.max(...Object.values(v).map((x) => x ?? -Infinity))
  );
  const selected = messages.filter((_, i) => future[i]);
  const affect = selected.length
    ? score(selected, models.affect, { ...options, aggregation: "mean" })
    : score([], models.affect, options);
  const scored = affect.messageValues.values();
  return {
    model: "optimism",
    status: !temporal.info.tokenCount
      ? "empty"
      : affect.status === "ok"
      ? "ok"
      : "no-matches",
    values: { OPTIMISM: affect.values.AFFECT ?? null },
    messageValues: future.map((f) => ({
      OPTIMISM: f ? scored.next().value!.AFFECT ?? null : null,
    })),
    matches: { OPTIMISM: affect.matches.AFFECT! },
    featureContributions: { OPTIMISM: {} },
    // Message and token counts cover the input; the rest, the scored messages.
    info: {
      ...affect.info,
      messageCount: temporal.info.messageCount,
      tokenCount: temporal.info.tokenCount,
    },
    warnings: affect.warnings,
  };
}
/** Select a bundled research model or supply a validated custom lexicon. */
export function analyse(
  input: Input,
  model: ModelId | Lexicon,
  options: Options = {},
): Analysis {
  if (model === "optimism") return optimism(input, options);
  const lexicon = typeof model === "string"
    ? Object.prototype.hasOwnProperty.call(models, model)
      ? models[model as LexiconId]
      : undefined
    : model;
  if (!lexicon) throw new RangeError(`Unknown model: ${String(model)}`);
  return score(input, lexicon, options);
}
