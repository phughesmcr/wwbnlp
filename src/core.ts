/** Shared weighted-lexicon engine. No I/O, global state, or runtime dependencies. */
import { tokenize } from "./tokenizer.ts";
export { tokenize };
export type Encoding = "frequency" | "binary" | "percent";
/**
 * How several messages become one result. `pool` scores them as one DLATK
 * group; `mean` averages per-message scores; `argmax` reports the share of
 * messages whose highest-scoring category is each category.
 */
export type Aggregation = "pool" | "mean" | "argmax";
export type Weights = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;
export interface LexiconDefinition {
  readonly id: string;
  readonly language?: string;
  readonly categories: Weights;
  readonly intercepts?: Readonly<Record<string, number>>;
  readonly features?: Weights;
  readonly ngrams?: readonly number[];
  readonly encoding?: Encoding;
  readonly aggregation?: Aggregation;
  /** Fewest tokens per group the model supports; smaller groups get a warning. */
  readonly minTokens?: number;
}
export interface Lexicon extends LexiconDefinition {
  readonly intercepts: Readonly<Record<string, number>>;
  readonly features: Weights;
  readonly ngrams: readonly number[];
  readonly encoding: Encoding;
  readonly aggregation: Aggregation;
}
/** One message's tokens. */
export type Tokens = readonly string[];
/** Message text, one message's tokens, or a group's messages as token arrays. */
export type Input = string | Tokens | readonly Tokens[];
export interface Options {
  /** Frequency divides each n-gram's occurrences by the number of n-grams of that size (DLATK group_norm). */
  readonly encoding?: Encoding;
  /** How several messages are combined; defaults to the lexicon's setting. */
  readonly aggregation?: Aggregation;
  /** Sizes include unigrams explicitly. An empty array disables lexical matching. */
  readonly ngrams?: readonly number[];
  readonly includeIntercept?: boolean;
  readonly minWeight?: number;
  readonly maxWeight?: number;
  /** Round final scores only. Omit to retain full floating-point precision. */
  readonly decimals?: number;
  /** Measured nonlexical covariates, added to every scored message or group. */
  readonly features?: Readonly<Record<string, number>>;
}
export interface Match {
  readonly term: string;
  /** Number of tokens in the matched window. */
  readonly n: number;
  readonly count: number;
  readonly weight: number;
  readonly contribution: number;
}
export interface Analysis {
  readonly model: string;
  readonly status: "ok" | "empty" | "no-matches";
  readonly values: Readonly<Record<string, number | null>>;
  /** Per-message scores (in input order) for `mean` and `argmax`; empty for `pool`. */
  readonly messageValues: readonly Readonly<Record<string, number | null>>[];
  readonly matches: Readonly<Record<string, readonly Match[]>>;
  readonly featureContributions: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
  readonly info: {
    readonly messageCount: number;
    readonly tokenCount: number;
    readonly featureCount: number;
    readonly matchedFeatureCount: number;
    readonly uniqueMatchedTerms: number;
  };
  readonly warnings: readonly string[];
}
const own = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);
function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
}
/** Array#every, except that holes fail: sparse arrays are malformed input. */
function every<T>(values: readonly T[], test: (value: T) => boolean): boolean {
  for (let i = 0; i < values.length; i++) {
    if (!(i in values) || !test(values[i]!)) return false;
  }
  return true;
}
function checkNgrams(value: readonly number[]): void {
  if (
    !Array.isArray(value) ||
    !every(value, (n) => Number.isSafeInteger(n) && n >= 1 && n <= 8)
  ) {
    throw new RangeError("ngrams must contain integer sizes from 1 to 8");
  }
}
function checkEncoding(value: unknown): asserts value is Encoding {
  if (!["frequency", "binary", "percent"].includes(value as string)) {
    throw new RangeError("Unknown encoding");
  }
}
function checkAggregation(value: unknown): asserts value is Aggregation {
  if (!["pool", "mean", "argmax"].includes(value as string)) {
    throw new RangeError("Unknown aggregation");
  }
}
/** Copy and validate a custom lexicon once; returned data cannot be mutated. */
export function createLexicon(definition: LexiconDefinition): Lexicon {
  if (
    !definition || typeof definition.id !== "string" || !definition.id ||
    !definition.categories || typeof definition.categories !== "object" ||
    Array.isArray(definition.categories)
  ) {
    throw new TypeError("A lexicon needs an id and category weight maps");
  }
  const categories: Record<string, Readonly<Record<string, number>>> = Object
    .create(null);
  const intercepts: Record<string, number> = Object.create(null);
  const features: Record<string, Readonly<Record<string, number>>> = Object
    .create(null);
  for (const [category, terms] of Object.entries(definition.categories)) {
    if (
      !category || !terms || typeof terms !== "object" || Array.isArray(terms)
    ) throw new TypeError("Invalid category");
    for (const [term, weight] of Object.entries(terms)) {
      if (!term) throw new TypeError("Lexicon terms must not be empty");
      finite(weight, `Weight for ${term}`);
    }
    categories[category] = Object.freeze({ ...terms });
    const intercept =
      definition.intercepts && own(definition.intercepts, category)
        ? definition.intercepts[category]
        : 0;
    finite(intercept, `Intercept for ${category}`);
    intercepts[category] = intercept;
    const covariates = definition.features && own(definition.features, category)
      ? definition.features[category]!
      : {};
    if (
      !covariates || typeof covariates !== "object" || Array.isArray(covariates)
    ) throw new TypeError("Feature weights must be a map");
    for (const [feature, weight] of Object.entries(covariates)) {
      finite(weight, `Feature weight for ${feature}`);
    }
    features[category] = Object.freeze({ ...covariates });
  }
  if (!Object.keys(categories).length) {
    throw new TypeError("A lexicon needs at least one category");
  }
  for (const key of Object.keys(definition.intercepts ?? {})) {
    if (!own(categories, key)) {
      throw new RangeError(`Unknown intercept category: ${key}`);
    }
  }
  for (const key of Object.keys(definition.features ?? {})) {
    if (!own(categories, key)) {
      throw new RangeError(`Unknown feature category: ${key}`);
    }
  }
  const ngrams = definition.ngrams ?? [1, 2, 3];
  const encoding = definition.encoding ?? "frequency";
  const aggregation = definition.aggregation ?? "pool";
  checkNgrams(ngrams);
  checkEncoding(encoding);
  checkAggregation(aggregation);
  if (
    definition.minTokens !== undefined &&
    (!Number.isSafeInteger(definition.minTokens) || definition.minTokens < 1)
  ) throw new RangeError("minTokens must be a positive integer");
  return Object.freeze({
    id: definition.id,
    ...(definition.language === undefined
      ? {}
      : { language: definition.language }),
    categories: Object.freeze(categories),
    intercepts: Object.freeze(intercepts),
    features: Object.freeze(features),
    ngrams: Object.freeze([...new Set(ngrams)]),
    encoding,
    aggregation,
    ...(definition.minTokens === undefined
      ? {}
      : { minTokens: definition.minTokens }),
  });
}
function toMessages(input: Input): readonly Tokens[] {
  if (typeof input === "string") return [tokenize(input)];
  const nested = Array.isArray(input) && input.length > 0 &&
    every(input, (message) => Array.isArray(message));
  const messages = (nested ? input : [input]) as readonly Tokens[];
  for (const tokens of messages) {
    if (
      !Array.isArray(tokens) ||
      !every(tokens, (t) => typeof t === "string" && t !== "")
    ) {
      throw new TypeError(
        "input must be text, an array of nonempty token strings, or an array of token arrays",
      );
    }
  }
  return messages;
}
interface Settings {
  readonly encoding: Encoding;
  readonly ngrams: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly intercept: boolean;
  readonly features: Readonly<Record<string, number>>;
}
interface Evaluation {
  readonly totals: Record<string, number>;
  readonly matches: Record<string, Match[]>;
  readonly covariates: Record<string, Record<string, number>>;
  readonly featureCount: number;
  readonly matched: Map<string, number>;
  readonly evidence: boolean;
}
/** Score one DLATK group: n-gram counts are pooled over its messages. */
function evaluate(
  messages: readonly Tokens[],
  lexicon: Lexicon,
  s: Settings,
): Evaluation {
  const counts = new Map<number, Map<string, number>>();
  const sizes = new Map<number, number>();
  let featureCount = 0;
  for (const n of new Set(s.ngrams)) {
    const grams = new Map<string, number>();
    let total = 0;
    for (const tokens of messages) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const term = tokens.slice(i, i + n).join(" ");
        grams.set(term, (grams.get(term) ?? 0) + 1);
        total++;
      }
    }
    counts.set(n, grams);
    sizes.set(n, total);
    featureCount += total;
  }
  const totals: Record<string, number> = Object.create(null);
  const matches: Record<string, Match[]> = Object.create(null);
  const covariates: Record<string, Record<string, number>> = Object.create(
    null,
  );
  const matched = new Map<string, number>();
  let evidence = false;
  for (const [category, weights] of Object.entries(lexicon.categories)) {
    let total = s.encoding === "percent" || !s.intercept
      ? 0
      : lexicon.intercepts[category]!;
    const categoryMatches: Match[] = [];
    const supplied: Record<string, number> = Object.create(null);
    let matchedCount = 0;
    for (const [n, grams] of counts) {
      for (const [term, count] of grams) {
        if (!own(weights, term)) continue;
        const weight = weights[term]!;
        if (weight < s.min || weight > s.max) continue;
        const contribution = s.encoding === "binary"
          ? weight
          : s.encoding === "percent"
          ? count / featureCount
          : weight * (count / sizes.get(n)!);
        total += contribution;
        matchedCount += count;
        categoryMatches.push({ term, n, count, weight, contribution });
        matched.set(`${n}\u0000${term}`, count);
      }
    }
    if (s.encoding === "percent") {
      total = featureCount ? matchedCount / featureCount : 0;
    } else {
      for (
        const [feature, weight] of Object.entries(lexicon.features[category]!)
      ) {
        if (own(s.features, feature)) {
          supplied[feature] = s.features[feature]! * weight;
          total += supplied[feature]!;
        }
      }
    }
    evidence ||= categoryMatches.length > 0 ||
      Object.keys(supplied).length > 0;
    if (!Number.isFinite(total)) {
      throw new RangeError(`Score overflow for ${category}`);
    }
    totals[category] = total;
    matches[category] = categoryMatches;
    covariates[category] = supplied;
  }
  return { totals, matches, covariates, featureCount, matched, evidence };
}
/** Average per-message evaluations; argmax shares are computed by the caller. */
function combine(
  evaluations: readonly Evaluation[],
  categories: readonly string[],
): Evaluation {
  const size = evaluations.length;
  const totals: Record<string, number> = Object.create(null);
  const matches: Record<string, Match[]> = Object.create(null);
  const covariates: Record<string, Record<string, number>> = Object.create(
    null,
  );
  const matched = new Map<string, number>();
  let featureCount = 0;
  for (const e of evaluations) {
    featureCount += e.featureCount;
    for (const [key, count] of e.matched) {
      matched.set(key, (matched.get(key) ?? 0) + count);
    }
  }
  for (const category of categories) {
    let total = 0;
    const merged = new Map<string, Match>();
    const supplied: Record<string, number> = Object.create(null);
    for (const e of evaluations) {
      total += e.totals[category]! / size;
      for (const m of e.matches[category]!) {
        const key = `${m.n}\u0000${m.term}`;
        const previous = merged.get(key);
        merged.set(key, {
          ...m,
          count: (previous?.count ?? 0) + m.count,
          contribution: (previous?.contribution ?? 0) + m.contribution / size,
        });
      }
      for (const [feature, value] of Object.entries(e.covariates[category]!)) {
        supplied[feature] = (supplied[feature] ?? 0) + value / size;
      }
    }
    totals[category] = total;
    matches[category] = [...merged.values()];
    covariates[category] = supplied;
  }
  return {
    totals,
    matches,
    covariates,
    featureCount,
    matched,
    evidence: evaluations.some((e) => e.evidence),
  };
}
/**
 * Score a validated lexicon. Token arrays are used exactly as supplied; ngrams
 * never span messages. A model's categories share one feature space, so once
 * any category has evidence every category is scored, intercept included.
 */
export function score(
  input: Input,
  lexicon: Lexicon,
  options: Options = {},
): Analysis {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object");
  }
  const allowed = [
    "encoding",
    "aggregation",
    "ngrams",
    "includeIntercept",
    "minWeight",
    "maxWeight",
    "decimals",
    "features",
  ];
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) {
      throw new RangeError(`Unknown option: ${key}`);
    }
  }
  const encoding = options.encoding ?? lexicon.encoding;
  const aggregation = options.aggregation ?? lexicon.aggregation;
  const ngrams = options.ngrams ?? lexicon.ngrams;
  const min = options.minWeight ?? -Infinity,
    max = options.maxWeight ?? Infinity;
  checkEncoding(encoding);
  checkAggregation(aggregation);
  checkNgrams(ngrams);
  if (
    typeof min !== "number" || typeof max !== "number" || Number.isNaN(min) ||
    Number.isNaN(max) || min > max
  ) throw new RangeError("Invalid weight bounds");
  if (
    options.includeIntercept !== undefined &&
    typeof options.includeIntercept !== "boolean"
  ) throw new TypeError("includeIntercept must be boolean");
  const decimals = options.decimals;
  if (
    decimals !== undefined &&
    (!Number.isInteger(decimals) || decimals < 0 || decimals > 15)
  ) throw new RangeError("decimals must be an integer from 0 to 15");
  const messages = toMessages(input);
  let tokenCount = 0;
  for (const tokens of messages) tokenCount += tokens.length;
  const features = options.features ?? {};
  if (typeof features !== "object" || Array.isArray(features)) {
    throw new TypeError("features must be an object");
  }
  const knownFeatures = new Set(
    Object.values(lexicon.features).flatMap((f) => Object.keys(f)),
  );
  for (const [key, value] of Object.entries(features)) {
    if (!knownFeatures.has(key)) {
      throw new RangeError(`Unknown model feature: ${key}`);
    }
    finite(value, `Feature ${key}`);
  }
  const settings: Settings = {
    encoding,
    ngrams,
    min,
    max,
    intercept: options.includeIntercept !== false,
    features,
  };
  const categories = Object.keys(lexicon.categories);
  const nulls = () =>
    Object.fromEntries(categories.map((c) => [c, null])) as Record<
      string,
      number | null
    >;
  const round = (value: number) =>
    decimals === undefined ? value : Number(value.toFixed(decimals));
  const finish = (totals: Record<string, number>) => {
    const values: Record<string, number | null> = Object.create(null);
    for (const c of categories) values[c] = round(totals[c]!);
    return values;
  };
  let result: Evaluation;
  let values: Record<string, number | null>;
  let messageValues: Record<string, number | null>[] = [];
  if (aggregation === "pool") {
    result = evaluate(
      messages,
      lexicon,
      tokenCount ? settings : { ...settings, features: {} },
    );
    values = tokenCount && result.evidence ? finish(result.totals) : nulls();
  } else {
    // Messages without tokens are not scored, as in DLATK.
    const scored = messages.map((m) =>
      m.length ? evaluate([m], lexicon, settings) : undefined
    );
    const present = scored.filter((e): e is Evaluation => e !== undefined);
    result = combine(present, categories);
    const evidence = present.length > 0 && result.evidence;
    messageValues = scored.map((e) =>
      e && evidence ? finish(e.totals) : nulls()
    );
    if (!evidence) values = nulls();
    else if (aggregation === "mean") values = finish(result.totals);
    else {
      const shares: Record<string, number> = Object.create(null);
      for (const c of categories) shares[c] = 0;
      for (const e of present) {
        const best = Math.max(...categories.map((c) => e.totals[c]!));
        const winners = categories.filter((c) => e.totals[c] === best);
        for (const c of winners) {
          shares[c]! += 1 / winners.length / present.length;
        }
      }
      values = finish(shares);
    }
  }
  const hasEvidence = tokenCount > 0 && result.evidence;
  let matchedFeatureCount = 0;
  for (const count of result.matched.values()) matchedFeatureCount += count;
  const matches: Record<string, Match[]> = Object.create(null);
  for (const c of categories) {
    matches[c] = result.matches[c]!.sort((a, b) =>
      b.count - a.count || a.term.localeCompare(b.term, "en") || a.n - b.n
    );
  }
  return {
    model: lexicon.id,
    status: !tokenCount ? "empty" : hasEvidence ? "ok" : "no-matches",
    values,
    messageValues,
    matches,
    featureContributions: result.covariates,
    info: {
      messageCount: messages.length,
      tokenCount,
      featureCount: result.featureCount,
      matchedFeatureCount,
      uniqueMatchedTerms: result.matched.size,
    },
    warnings: [
      ...(encoding === "percent"
        ? []
        : [...knownFeatures].filter((f) => !own(features, f)).map((f) =>
          `Structural feature ${f} was not supplied; its contribution is omitted.`
        )),
      ...(lexicon.minTokens !== undefined && tokenCount &&
          tokenCount < lexicon.minTokens
        ? [
          `${lexicon.id} supports groups of at least ${lexicon.minTokens} tokens; scores of ${tokenCount} tokens are unreliable.`,
        ]
        : []),
    ],
  };
}
