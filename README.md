# wwbnlp

**World Wellbeing NLP** — weighted-lexicon research tools in one typed,
dependency-free package.

Sentiment and arousal, temporal orientation, PERMA in English and Spanish, Big
Five associations, Dark Triad scores, age and historical binary-gender scores,
and an experimental optimism composition. This consolidates Peter Hughes’s
earlier npm modules around one inspectable scoring engine.

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

// User-level models (age, gender, PERMA, ...) pool a person’s messages:
const posts = ["Off to the beach!", "Long day at work..."];
const user = analyse(posts.map(tokenize), "age");
```

All analysis runs locally. The package makes no network requests and logs no
input text.

## Models

| Model ID    | Replaces           | What the scores represent                                                                 | Default encoding |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------- | ---------------- |
| `affect`    | affectimo          | AFFECT (valence) and INTENSITY (arousal)                                                  | frequency        |
| `bigFive`   | bigfive            | O, C, E, A, N lexical association sums, **not calibrated trait predictions**              | binary           |
| `darkTriad` | darktriad          | Historical darktriad, machiavellianism, narcissism, psychopathy scores on a log scale     | frequency        |
| `optimism`  | optimismo          | Affect weights restricted to the old future-term vocabulary; **experimental composition** | binary           |
| `age`       | predictage         | AGE research regression output                                                            | frequency        |
| `gender`    | predictgender      | GENDER historical classifier margin, **not a probability or gender identity**             | frequency        |
| `temporal`  | prospectimo        | PAST, PRESENT, FUTURE one-vs-rest log-odds per message                                    | binary           |
| `perma`     | wellbeing_analysis | English positive/negative P, E, R, M, A lexical components                                | frequency        |
| `permaEs`   | wellbeing_analysis | Spanish positive/negative P, E, R, M, A linear scores                                     | frequency        |

`lex-helpers` and `weighted-lexica` become `createLexicon`, `score`, and
`tokenize`. The [`wwbnlp/core`](docs/api.md) entry point loads the generic
engine without bundled research data.

## Explicit, inspectable results

`analyse(textOrTokens, model, options)` always returns the same result shape:

- `status`: `ok`, `empty`, or `no-matches`.
- `values`: every model category; `null` when that category has no evidence.
- `matches`: per-category `{ term, n, count, weight, contribution }` records.
- `featureContributions`: supplied structural covariates and their
  contributions.
- `info`: `messageCount`, `tokenCount`, `featureCount`, `matchedFeatureCount`,
  `uniqueMatchedTerms`.
- `warnings`: omitted structural features, where relevant.

Unmatched input does not silently turn into an intercept-only prediction. Scores
are neither clamped to a scale nor converted to labels automatically.

Frequency encoding follows DLATK:
`intercept + Σ(weight × occurrences / ngramsOfThatSize)`. For unigrams the
denominator is the token count, unmatched tokens included; for bigrams it is the
number of bigrams, and so on. Binary encoding adds each matched term’s weight
once. Percent encoding reports matched candidate-feature occurrences divided by
all candidate-feature occurrences, excluding weights, intercepts and structural
covariates.

Defaults include every ngram size present in each model’s vocabulary (age and
gender are unigram-only, as published). Supply `ngrams: [1]` for unigrams only,
or `[]` to disable lexical matching. Ngrams are contiguous sequences within one
message, including punctuation; they never span messages.

## Reproducibility

`tokenize` ports the studies’ preprocessing: DLATK message cleaning (newlines
become `<newline>`, runs of five or more dots become `....`) and the Happier Fun
Tokenizer, lowercased. It reproduces the pinned Python original on the test
fixtures, quirks included: `I’m` becomes `i`, `’`, `m`; spaced dots `. . .` are
one token; URLs split after a known domain. Apply the same anonymization as the
training data where a lexicon expects it (e.g. PERMA’s `@name_removed`). Token
arrays are used as supplied.

```js
const result = analyse(["really", "good", "!"], "affect", {
  encoding: "frequency",
  includeIntercept: true,
  decimals: 9,
});
```

English PERMA includes four named structural covariates. Their weights are
retained, but their values cannot be inferred reliably from one arbitrary text.
Supply values measured with your research pipeline via `features`; omitted
contributions produce warnings. DLATK defines `_avgNgramsPerMsg` as a user’s
n-grams divided by messages and `_avgNgramLength` as characters per n-gram.
Lexical-only results are not a reproduction of the full trained pipeline.

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
labels; Big Five associations and the optimism composition are not validated
standalone predictors.

Research coefficients retain **CC BY-NC-SA 3.0**, including the noncommercial
restriction. The package uses the same licence. Original MIT utility notices are
retained in `licenses/`; see [NOTICE.md](NOTICE.md) for attribution. This is an
independent implementation, not an official WWBP distribution.
