# wwbnlp

**World Wellbeing NLP** — weighted-lexicon research tools in one typed,
dependency-free package.

Sentiment and arousal, temporal orientation, PERMA in English and Spanish, Big
Five associations, Dark Triad scores, age and historical binary-gender scores,
and optimism (the valence of future-oriented messages). This consolidates Peter
Hughes’s earlier npm modules around one inspectable scoring engine.

## Get started

Install [wwbnlp](https://www.npmjs.com/package/wwbnlp) from npm:

```sh
npm install wwbnlp
```

Requires Node.js 22.12 or later. ESM and native `require()` on supported Node
versions use the same module. The package is maintained by
[phughesmcr](https://www.npmjs.com/~phughesmcr).

```js
import { analyse, tokenize } from "wwbnlp";

const result = analyse("I love spending time with my family :)", "affect");
console.log(result.values); // AFFECT and INTENSITY scores, or null without evidence
console.log(result.matches.AFFECT); // terms, counts, weights, contributions
console.log(result.info); // message, token and matched feature counts

// Pass a person’s messages as an array of token arrays. Each model combines
// them as its paper did: age pools them; PERMA averages message predictions.
const posts = ["Off to the beach!", "Long day at work..."];
const age = analyse(posts.map(tokenize), "age");
const perma = analyse(posts.map(tokenize), "perma");
console.log(perma.messageValues); // per-message PERMA predictions
```

All analysis runs locally. The package makes no network requests and logs no
input text.

## Models

| Model ID    | Replaces           | What the scores represent                                                                                   | Encoding, aggregation |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------- |
| `affect`    | affectimo          | AFFECT (valence, 1–9, 5 neutral) and INTENSITY (arousal, 1–9, 1 neutral) per post                           | binary, mean          |
| `bigFive`   | bigfive            | O, C, E, A, N lexical association sums, **not calibrated trait predictions**                                | binary, pool          |
| `darkTriad` | darktriad          | darktriad, machiavellianism, narcissism, psychopathy: ln of the 1–5 scale; ≥ 500 tokens; **unvalidated**    | frequency, pool       |
| `optimism`  | optimismo          | OPTIMISM: mean valence (1–9) of the messages classified as future-oriented                                  | temporal, then affect |
| `age`       | predictage         | AGE in years                                                                                                | frequency, pool       |
| `gender`    | predictgender      | GENDER classifier margin: ≥ 0 the source’s female label, < 0 male; **not a probability or gender identity** | frequency, pool       |
| `temporal`  | prospectimo        | Share of messages classified PAST, PRESENT or FUTURE; per-message one-vs-rest log-odds in `messageValues`   | binary, argmax        |
| `perma`     | wellbeing_analysis | English positive/negative P, E, R, M, A message ratings (0–6), lexical component                            | binary, mean          |
| `permaEs`   | wellbeing_analysis | Spanish positive/negative P, E, R, M, A message ratings (1–7)                                               | binary, mean          |

Message-level models (`affect`, `temporal`, `perma`, `permaEs`) were trained on
single posts. Given several messages, they score each one and average the
predictions (`mean`) or report the share of messages in each class (`argmax`),
as the PERMA and temporal papers did; the affect paper scored single posts only,
so averaging affect is this package’s choice. User-level models (`age`,
`gender`, `bigFive`, `darkTriad`) score a user’s messages as one pooled group
(`pool`). `optimism` follows WWBP’s guidance: “filter messages to those
future-oriented using the future orientation lexicon, then apply the affect
lexicon”. Age and gender were trained on Facebook and blog users with at least
1,000 words. Dark Triad warns below the authors’ recommended 500 tokens.

`lex-helpers` and `weighted-lexica` become `createLexicon`, `score`, and
`tokenize`. The [`wwbnlp/core`](docs/api.md) entry point loads the generic
engine without bundled research data.

## Explicit, inspectable results

`analyse(textOrTokens, model, options)` always returns the same result shape:

- `status`: `ok`, `empty`, or `no-matches`.
- `values`: every model category; all `null` when no category has evidence.
- `messageValues`: per-message scores for `mean` and `argmax` models, in input
  order; empty for `pool`.
- `matches`: per-category `{ term, n, count, weight, contribution }` records.
- `featureContributions`: supplied structural covariates and their
  contributions.
- `info`: `messageCount`, `tokenCount`, `featureCount`, `matchedFeatureCount`,
  `uniqueMatchedTerms`.
- `warnings`: omitted structural features, and groups smaller than a model’s
  `minTokens`.

Unmatched input does not silently turn into an intercept-only prediction. Once
any category matches, every category is scored, intercept included, because a
model’s categories share one feature space. Within a group of messages, a
message without matches predicts its intercepts, as in the PERMA and temporal
papers. Scores are neither clamped to a scale nor converted to labels
automatically.

Frequency encoding follows DLATK:
`intercept + Σ(weight × occurrences / ngramsOfThatSize)`. For unigrams the
denominator is the token count, unmatched tokens included; for bigrams it is the
number of bigrams, and so on. Binary encoding adds each matched term’s weight
once. Percent encoding, a non-DLATK convenience, reports matched
candidate-feature occurrences divided by all candidate-feature occurrences,
excluding weights, intercepts and structural covariates.

Defaults include every ngram size present in each model’s vocabulary (age and
gender are unigram-only, as published). Supply `ngrams: [1]` for unigrams only,
or `[]` to disable lexical matching. Ngrams are contiguous sequences within one
message, including punctuation; they never span messages.

## Reproducibility

`tokenize` ports DLATK’s preprocessing, which most of the studies used: message
cleaning (newlines become `<newline>`, runs of five or more dots become `....`)
and the Happier Fun Tokenizer, lowercased. It reproduces the pinned Python
original on the test fixtures, quirks included: `I’m` becomes `i`, `’`, `m`;
spaced dots `. . .` are one token; URLs split after a known domain. Apply the
same anonymization as the training data where a lexicon expects it (e.g. PERMA’s
`@name_removed`). Token arrays are used as supplied.

```js
const result = analyse(["really", "good", "!"], "affect", {
  encoding: "frequency",
  includeIntercept: true,
  decimals: 9,
});
```

English PERMA includes four named structural covariates (n-grams per message and
characters per n-gram). DLATK never applies them when it scores with this
lexicon, because they are not in its ngram tables. Each pair also has identical
weights, which suggests an export artefact, and including them pushes ordinary
posts beyond the 0–6 scale. They are therefore not computed; supply them via
`features` if you need them, and omitted contributions produce warnings.
Lexical-only results are not a reproduction of the full trained pipeline. The
released Dark Triad weights are coefficients of standardized word-cluster
features; they are rescaled with cluster means and deviations from the authors’
released dataset, which does not allow the scores to be validated. See
[research methods](docs/research.md).

See [API](docs/api.md), [migration](docs/migration.md), and
[research methods and sources](docs/research.md). Each imported file has a
pinned Git commit and SHA-256 in [data/provenance.json](data/provenance.json).
`python3 scripts/import-data.py --check` verifies every coefficient against
those sources; `python3 scripts/dlatk-reference.py` regenerates the tokenizer
and scoring fixtures from the original Python tokenizer.

## Development

```sh
npm ci
npm test            # shared-engine examples, edge cases and all-model regressions
npm run check       # strict TypeScript, Deno lint and formatting
npm pack --dry-run  # inspect the npm package
```

Deno 2 is needed for `npm run check`. The built modules also run under Deno; CI
tests Node 22/24/26 and Deno.

## Research scope and licence

These historical social-media lexica produce research scores. The implementation
does not establish current accuracy, diagnose an individual, or reproduce
papers’ headline performance. Domain, language, tokenization and missing
covariates affect results. The demographic models reflect historical training
labels; Big Five associations and optimism are not validated standalone
predictors.

Research coefficients retain **CC BY-NC-SA 3.0**, including the noncommercial
restriction. The package uses the same licence. Original MIT utility notices are
retained in `licenses/`; see [NOTICE.md](NOTICE.md) for attribution. This is an
independent implementation, not an official WWBP distribution.
