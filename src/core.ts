/** Shared weighted-lexicon engine. No I/O, global state, or runtime dependencies. */
import { tokenize } from "./tokenizer.ts";
export { tokenize };
export type Encoding = "frequency" | "binary" | "percent";
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
}
export interface Lexicon extends LexiconDefinition {
  readonly intercepts: Readonly<Record<string, number>>;
  readonly features: Weights;
  readonly ngrams: readonly number[];
  readonly encoding: Encoding;
}
/** One message's tokens. */
export type Tokens = readonly string[];
/** Message text, one message's tokens, or a group's messages as token arrays. */
export type Input = string | Tokens | readonly Tokens[];
export interface Options {
  /** Frequency divides each n-gram's occurrences by the number of n-grams of that size (DLATK group_norm). */
  readonly encoding?: Encoding;
  /** Sizes include unigrams explicitly. An empty array disables lexical matching. */
  readonly ngrams?: readonly number[];
  readonly includeIntercept?: boolean;
  readonly minWeight?: number;
  readonly maxWeight?: number;
  /** Round final scores only. Omit to retain full floating-point precision. */
  readonly decimals?: number;
  /** Measured nonlexical covariates; never infer these from a single text. */
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
function checkNgrams(value: readonly number[]): void {
  if (
    !Array.isArray(value) ||
    value.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 8)
  ) {
    throw new RangeError("ngrams must contain integer sizes from 1 to 8");
  }
}
function checkEncoding(value: unknown): asserts value is Encoding {
  if (!["frequency", "binary", "percent"].includes(value as string)) {
    throw new RangeError("Unknown encoding");
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
  checkNgrams(ngrams);
  checkEncoding(encoding);
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
  });
}
function toMessages(input: Input): readonly Tokens[] {
  if (typeof input === "string") return [tokenize(input)];
  const nested = Array.isArray(input) && input.length > 0 &&
    input.every((message) => Array.isArray(message));
  const messages = (nested ? input : [input]) as readonly Tokens[];
  for (const tokens of messages) {
    if (
      !Array.isArray(tokens) ||
      tokens.some((t) => typeof t !== "string" || !t)
    ) {
      throw new TypeError(
        "input must be text, an array of nonempty token strings, or an array of token arrays",
      );
    }
  }
  return messages;
}
/**
 * Score a validated lexicon. Token arrays are used exactly as supplied; ngrams
 * never span messages.
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
  const ngrams = options.ngrams ?? lexicon.ngrams;
  const min = options.minWeight ?? -Infinity,
    max = options.maxWeight ?? Infinity;
  checkEncoding(encoding);
  checkNgrams(ngrams);
  if (
    typeof min !== "number" || typeof max !== "number" || Number.isNaN(min) ||
    Number.isNaN(max) || min > max
  ) throw new RangeError("Invalid weight bounds");
  if (
    options.includeIntercept !== undefined &&
    typeof options.includeIntercept !== "boolean"
  ) throw new TypeError("includeIntercept must be boolean");
  if (
    options.decimals !== undefined &&
    (!Number.isInteger(options.decimals) || options.decimals < 0 ||
      options.decimals > 15)
  ) throw new RangeError("decimals must be an integer from 0 to 15");
  const messages = toMessages(input);
  let tokenCount = 0;
  for (const tokens of messages) tokenCount += tokens.length;
  const suppliedFeatures = options.features ?? {};
  if (typeof suppliedFeatures !== "object" || Array.isArray(suppliedFeatures)) {
    throw new TypeError("features must be an object");
  }
  const knownFeatures = new Set(
    Object.values(lexicon.features).flatMap((f) => Object.keys(f)),
  );
  for (const [key, value] of Object.entries(suppliedFeatures)) {
    if (!knownFeatures.has(key)) {
      throw new RangeError(`Unknown model feature: ${key}`);
    }
    finite(value, `Feature ${key}`);
  }
  const counts = new Map<number, Map<string, number>>();
  const totals = new Map<number, number>();
  let featureCount = 0;
  for (const n of new Set(ngrams)) {
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
    totals.set(n, total);
    featureCount += total;
  }
  const values: Record<string, number | null> = Object.create(null);
  const matches: Record<string, Match[]> = Object.create(null);
  const featureContributions: Record<string, Record<string, number>> = Object
    .create(null);
  const matchedTerms = new Map<string, number>();
  let hasEvidence = false;
  const warnings = encoding === "percent"
    ? []
    : [...knownFeatures].filter((f) => !own(suppliedFeatures, f)).map((f) =>
      `Structural feature ${f} was not supplied; its contribution is omitted.`
    );
  for (const [category, weights] of Object.entries(lexicon.categories)) {
    let total = encoding === "percent" || options.includeIntercept === false
      ? 0
      : lexicon.intercepts[category]!;
    const categoryMatches: Match[] = [];
    const covariates: Record<string, number> = Object.create(null);
    let matchedCount = 0;
    for (const [n, grams] of counts) {
      for (const [term, count] of grams) {
        if (!own(weights, term)) continue;
        const weight = weights[term]!;
        if (weight < min || weight > max) continue;
        const contribution = encoding === "binary"
          ? weight
          : encoding === "percent"
          ? count / featureCount
          : weight * (count / totals.get(n)!);
        total += contribution;
        matchedCount += count;
        categoryMatches.push({ term, n, count, weight, contribution });
        matchedTerms.set(`${n}\u0000${term}`, count);
      }
    }
    if (encoding === "percent") {
      total = featureCount ? matchedCount / featureCount : 0;
    }
    if (encoding !== "percent" && tokenCount) {
      for (
        const [feature, weight] of Object.entries(lexicon.features[category]!)
      ) {
        if (own(suppliedFeatures, feature)) {
          const contribution = suppliedFeatures[feature]! * weight;
          covariates[feature] = contribution;
          total += contribution;
        }
      }
    }
    const evidence = tokenCount > 0 &&
      (categoryMatches.length > 0 || Object.keys(covariates).length > 0);
    hasEvidence ||= evidence;
    if (!Number.isFinite(total)) {
      throw new RangeError(`Score overflow for ${category}`);
    }
    values[category] = evidence
      ? options.decimals === undefined
        ? total
        : Number(total.toFixed(options.decimals))
      : null;
    matches[category] = categoryMatches.sort((a, b) =>
      b.count - a.count || a.term.localeCompare(b.term, "en") || a.n - b.n
    );
    featureContributions[category] = covariates;
  }
  let matchedFeatureCount = 0;
  for (const count of matchedTerms.values()) matchedFeatureCount += count;
  return {
    model: lexicon.id,
    status: !tokenCount ? "empty" : hasEvidence ? "ok" : "no-matches",
    values,
    matches,
    featureContributions,
    info: {
      messageCount: messages.length,
      tokenCount,
      featureCount,
      matchedFeatureCount,
      uniqueMatchedTerms: matchedTerms.size,
    },
    warnings,
  };
}
