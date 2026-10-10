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
frequency encoding, `pool` aggregation and `[1, 2, 3]` ngrams.

`score` and `analyse` return `Analysis` with category maps and explicit status;
see the README. Categories share evidence: if no category has a lexical match or
supplied structural feature, every value is `null` (`no-matches`), even with
intercepts; otherwise every category is scored, intercept included. Empty input
returns `empty` and all-null values.

## Aggregation

Input with several messages is combined by the lexicon’s `aggregation`, which
the option of the same name overrides:

- `pool`: all messages form one DLATK group. Frequencies are relative to the
  group’s ngrams; binary counts each term once per group. For user-level models.
- `mean`: each nonempty message is scored on its own, and each category’s value
  is the mean over those messages. A message without matches contributes its
  intercepts. For message-level regression models.
- `argmax`: each nonempty message is scored and assigned to its highest-scoring
  category; values are the share of messages in each category, summing to one.
  Ties split a message equally. For message-level classifiers.

With `mean` and `argmax`, `messageValues` holds each message’s scores in input
order (`null` for empty messages), and matches report total counts with
contributions averaged over the scored messages, so `values` still equals the
intercept plus the summed contributions under `mean`. If no message has a match,
every value is `null`. Single-message input behaves identically under `pool` and
`mean`.

## Options

| Option                   | Default                    | Meaning                                                           |
| ------------------------ | -------------------------- | ----------------------------------------------------------------- |
| `encoding`               | Model default              | `frequency`, `binary`, or `percent`                               |
| `aggregation`            | Model default              | `pool`, `mean`, or `argmax`; see above                            |
| `ngrams`                 | Model vocabulary sizes     | Unique integer sizes 1–8; `[]` disables matching                  |
| `includeIntercept`       | `true`                     | Include the model intercept, except in percent mode               |
| `minWeight`, `maxWeight` | Negative/positive infinity | Inclusive term-weight filters                                     |
| `decimals`               | Omitted                    | Round final category scores only, 0–15 decimal places             |
| `features`               | `{}`                       | Finite measured structural values; keys must belong to this model |

Unrecognized options throw, so legacy options cannot be silently ignored.
Options, definitions and input arrays are never modified.

Frequency mode divides each matched feature’s occurrence count by the number of
ngrams of the same size (DLATK `group_norm`) in the group, before adding its
weight and intercept. Ngrams never span messages. Binary mode counts unique
terms once per group. Percent mode, which is not a DLATK measure, measures
coverage of generated candidate features; repeated terms count, weights do not,
and the result stays between zero and one.

`matches` sort by descending occurrence count, then term; `n` is the matched
window size. Contributions retain full precision even when final values are
rounded. `matchedFeatureCount` counts each matched occurrence once across all
categories. It includes ngrams, so it is not a count of distinct word positions.

Structural values are multiplied by their weights and added once per category,
to every scored message under `mean` and `argmax`. Under `mean`, supplying each
feature’s mean over the messages is therefore exact. They are independent of
lexical `minWeight`/`maxWeight` filters and are ignored in percent mode. Missing
structural values produce warnings in weighted modes. Supplied zeros are
measurements and count as evidence. Supply the same feature definitions and
units as the original research pipeline; the engine does not invent them.

## `tokenize(text)`

Tokenizes one message with DLATK cleaning and the Happier Fun Tokenizer, as
documented in [research methods](research.md). HTML entities are decoded as HFT
does. There is no automatic British-to-American translation or language
detection. Spanish uses the explicit `permaEs` model.

## `models`

Readonly registry of the eight bundled lexicon definitions. `optimism` is not a
lexicon: `analyse` combines `models.temporal` and `models.affect`. Categories,
coefficients, intercepts, structural features and default ngram sizes are
available for inspection. Importing `wwbnlp/core` avoids loading this registry.

## Runtime support

ESM, typed declarations, Node.js 22.12+ native `require()` of ESM, and Deno 2
with the built entry point. JSON modules use import attributes. Older
Node/CommonJS applications must upgrade or use dynamic import where supported.
No browser support claim is made without testing a specific bundler/runtime.
