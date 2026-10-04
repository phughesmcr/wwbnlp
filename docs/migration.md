# Migrating to wwbnlp

The existing npm releases remain available. Archiving GitHub repositories does
not unpublish npm versions, and this consolidation does not replace existing
dependencies automatically. The legacy npm account is
[phughes](https://www.npmjs.com/~phughes).

The new [wwbnlp](https://www.npmjs.com/package/wwbnlp) package is maintained by
[phughesmcr](https://www.npmjs.com/~phughesmcr). Install it with
`npm install wwbnlp` and migrate explicitly using the model IDs below.

## Imports and model IDs

| Existing package   | Last observed npm version              | New call                                               |
| ------------------ | -------------------------------------- | ------------------------------------------------------ |
| affectimo          | 3.1.0                                  | `analyse(text, 'affect')`                              |
| bigfive            | 3.0.0                                  | `analyse(text, 'bigFive')`                             |
| darktriad          | 3.1.1                                  | `analyse(text, 'darkTriad')`                           |
| optimismo          | 4.0.1                                  | `analyse(text, 'optimism')`                            |
| predictage         | 4.0.1                                  | `analyse(text, 'age')`                                 |
| predictgender      | 4.0.0                                  | `analyse(text, 'gender')`                              |
| prospectimo        | 3.0.0                                  | `analyse(text, 'temporal')`                            |
| wellbeing_analysis | 4.0.0                                  | `analyse(text, 'perma')` or `analyse(text, 'permaEs')` |
| lex-helpers        | 0.6.0                                  | `createLexicon` and `score` from `wwbnlp/core`         |
| weighted-lexica    | Not found under this unscoped npm name | `createLexicon` and `score` from `wwbnlp/core`         |

Registry versions were checked on 4 October 2026. `weighted-lexica` may have
been published under a different name or scope; a 404 does not establish that no
release ever existed.

```js
// Before
const affectimo = require("affectimo");
const values = affectimo(text);

// After
import { analyse } from "wwbnlp";
const result = analyse(text, "affect");
const valuesAfter = result.values;
```

Native CommonJS works on Node 22.12+:

```js
const { analyse } = require("wwbnlp");
const result = analyse(text, "affect");
```

## Intentional changes

This is a new API, not a drop-in wrapper or promise of numerically identical
output.

- Always read `result.values`, `result.matches` and `result.info`. There are no
  `output: 'lex'/'matches'/'full'` modes.
- No data or no matching evidence yields explicit status and null category
  values. Intercepts alone cannot turn unknown input into a prediction.
- Affect, temporal orientation and PERMA now default to relative frequency,
  rather than the old binary sums. Big Five and optimism retain binary sums as
  association measures. Request an encoding explicitly for comparisons.
- Canonical WWBP CSV weights and intercepts replace rounded or damaged legacy
  copies where available. Spanish accents are restored, and `permaEs` selects
  Spanish directly. The old wellbeing module mistakenly inspected `output`
  rather than `lang` when selecting Spanish.
- Matching uses one token stream for all ngrams. All vocabulary ngram sizes are
  enabled by default; the old age/gender wrappers ignored phrase terms. To
  compare unigrams, set `ngrams: [1]` and supply controlled tokens.
- English PERMA’s structural feature weights are retained and missing inputs are
  reported. Lexical-only results should not be described as the complete
  original trained model.
- Big Five retains historical association weights except an invalid empty-string
  O term. Scores have no calibrated personality scale.
- Optimism is an experimental composition of future terms and affect weights. It
  is not a separately trained optimism predictor.
- Gender returns the historical classifier margin, without converting it into an
  assertion about identity. The historical sign convention was negative/positive
  for the source’s male/female labels.
- Temporal scores are not probabilities. Any ranking must handle nulls and ties
  explicitly; there is no automatic “Unknown” or orientation label.
- Results are synchronous with no async dependency or mutable global state.
  Caller options are never mutated.

## Options

| Previous option       | New equivalent                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `encoding: 'freq'`    | `encoding: 'frequency'`                                                      |
| `encoding: 'binary'`  | Same unique-term sum semantics                                               |
| `encoding: 'percent'` | Candidate-feature coverage fraction; no intercept                            |
| `nGrams: [2, 3]`      | `ngrams: [1, 2, 3]` (unigrams are explicit)                                  |
| `nGrams: [0]`         | `ngrams: [1]` to keep unigrams only                                          |
| `noInt: true`         | `includeIntercept: false`                                                    |
| `min`, `max`          | `minWeight`, `maxWeight`                                                     |
| `places`              | `decimals` (final scores only)                                               |
| `logs`, `suppressLog` | Removed; the library does not log                                            |
| `sortBy`              | Sort `result.matches[category]` in your application                          |
| `wcGrams`             | Removed; weighted frequency uses original tokens                             |
| `locale`              | Normalize spelling in your preprocessing if needed; no automatic translation |
| `lang: 'spanish'`     | Model ID `permaEs`                                                           |

## Utility packages

Replace `lexFrequencyPipeline(lex, intercept)` with a lexicon configured for
`[1]` and `frequency`, then read `score(tokens, lexicon).values.CATEGORY`. The
old `lexBinaryPipeline` divided unique weights by the number of unique tokens;
the new `binary` encoding sums unique weights without that division. Use
explicit arithmetic if you need the old normalized-unique formula.

The previous `Term`/`Category`/`Lexicon` object graph is replaced by immutable
category-to-weight maps. Build a new definition to change vocabulary rather than
maintaining bidirectional mutable associations. The new engine includes category
intercepts; the old `weighted-lexica.analyse()` implementation created an empty
intercept map and never filled it.

## Maintainer release sequence

1. Run tests, source verification and package inspection; review the tarball.
2. Publish `wwbnlp` from the `phughesmcr` npm account, after authentication and
   any npm-required account confirmation.
3. Verify the installed registry package and its bundled installation
   instructions.
4. If retiring the old npm names, add a deprecation message linking to this
   guide. Deprecation is a separate registry change; it has not been applied by
   archiving repositories. Keep old versions available for reproducibility.
