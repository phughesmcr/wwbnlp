# API

## `analyse(input, model, options?)`

Import from `wwbnlp`. `input` is message text, one message’s readonly array of
nonempty token strings, or an array of such token arrays (one per message, e.g.
`posts.map(tokenize)`). `model` is one of the nine model IDs in the README, or a
lexicon returned by `createLexicon`. Invalid model names, inputs and options
throw; they never fall back to another model or encoding.

## `createLexicon(definition)` and `score(input, lexicon, options?)`

Import from `wwbnlp/core` to use your own data without loading the bundled
lexica:

```js
import { createLexicon, score } from "wwbnlp/core";

const lexicon = createLexicon({
  id: "example",
  categories: { SENTIMENT: { good: 2, bad: -2, "really good": 3 } },
  intercepts: { SENTIMENT: 0.5 },
  ngrams: [1, 2],
  encoding: "frequency",
});

console.log(score(["really", "good", "good"], lexicon).values);
// { SENTIMENT: 3.333333333333333 }  (0.5 + 2 × 2/3 + 3 × 1/2)
```

Definitions are validated, copied and frozen. Every category needs a
term-to-finite-weight map. Intercepts default to zero. Optional structural
feature weights use the same category map shape, keyed by feature names. Unknown
intercept/feature categories are rejected. Custom definitions default to
frequency encoding and `[1, 2, 3]` ngrams.

`score` and `analyse` return `Analysis` with category maps and explicit status;
see the README. A category without a lexical match or supplied structural
feature returns `null`, even if it has an intercept. Empty input returns `empty`
and all-null values. Mixed evidence can produce both numbers and nulls in the
same result.

## Options

| Option                   | Default                    | Meaning                                                           |
| ------------------------ | -------------------------- | ----------------------------------------------------------------- |
| `encoding`               | Model default              | `frequency`, `binary`, or `percent`                               |
| `ngrams`                 | Model vocabulary sizes     | Unique integer sizes 1–8; `[]` disables matching                  |
| `includeIntercept`       | `true`                     | Include the model intercept, except in percent mode               |
| `minWeight`, `maxWeight` | Negative/positive infinity | Inclusive term-weight filters                                     |
| `decimals`               | Omitted                    | Round final category scores only, 0–15 decimal places             |
| `features`               | `{}`                       | Finite measured structural values; keys must belong to this model |

Unrecognized options throw, so legacy options cannot be silently ignored.
Options, definitions and input arrays are never modified.

Frequency mode divides each matched feature’s occurrence count by the number of
ngrams of the same size (DLATK `group_norm`), summed over messages, before
adding its weight and intercept. Ngrams never span messages. Binary mode counts
unique terms once. Percent mode measures coverage of generated candidate
features; repeated terms count, weights do not, and the result stays between
zero and one.

`matches` sort by descending occurrence count, then term; `n` is the matched
window size. Contributions retain full precision even when final values are
rounded. `matchedFeatureCount` counts each matched occurrence once across all
categories. It includes ngrams, so it is not a count of distinct word positions.

Structural values are multiplied by their weights and added once per category.
They are independent of lexical `minWeight`/`maxWeight` filters and are ignored
in percent mode. Missing structural values produce warnings in weighted modes.
Supplied zeros are measurements and count as evidence. Supply the same feature
definitions and units as the original research pipeline; the engine does not
invent them.

## `tokenize(text)`

Tokenizes one message with DLATK cleaning and the Happier Fun Tokenizer, as
documented in [research methods](research.md). HTML entities are decoded as HFT
does. There is no automatic British-to-American translation or language
detection. Spanish uses the explicit `permaEs` model.

## `models`

Readonly registry of bundled model definitions. Categories, coefficients,
intercepts, structural features and default ngram sizes are available for
inspection. Importing `wwbnlp/core` avoids loading this registry.

## Runtime support

ESM, typed declarations, Node.js 22.12+ native `require()` of ESM, and Deno 2
with the built entry point. JSON modules use import attributes. Older
Node/CommonJS applications must upgrade or use dynamic import where supported.
No browser support claim is made without testing a specific bundler/runtime.
