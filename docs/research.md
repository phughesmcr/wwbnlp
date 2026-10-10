# Research methods and data provenance

This package consolidates historical lexicon implementations. It verifies
coefficient provenance and arithmetic, not the full empirical findings of the
original papers. Tests do not establish out-of-domain accuracy or reproduce
cross-validation results.

## Published sources

| Model                | Research source                                                                                                                                                     | Coefficient source                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Affect/intensity     | Preoţiuc-Pietro et al. (2016), [Modelling Valence and Arousal in Facebook posts](https://aclanthology.org/W16-0404/)                                                | WWBP `affect_intensity/affect_intensity_lexicon.csv`                       |
| Age/gender           | Sap et al. (2014), [Developing Age and Gender Predictive Lexica over Social Media](https://aclanthology.org/D14-1121/)                                              | WWBP `age_gender/emnlp14age.csv` and `emnlp14gender.csv`                   |
| Temporal orientation | Schwartz et al. (2015), [Extracting Human Temporal Orientation from Facebook Language](https://aclanthology.org/N15-1044/)                                          | WWBP `temporal_orientation/temporal_orientation_lexicon.csv`               |
| English PERMA        | Schwartz et al. (2016), [Predicting Individual Well-Being Through the Language of Social Media](https://psb.stanford.edu/psb-online/proceedings/psb16/schwartz.pdf) | WWBP `perma/permaV3_dd.csv`                                                |
| Spanish PERMA        | Smith et al. (2016), [Does ‘well-being’ translate on Twitter?](https://aclanthology.org/D16-1217/)                                                                  | WWBP `spanish_perma/spanish_perma_v1.csv`                                  |
| Big Five             | Schwartz et al. (2013), [Personality, Gender, and Age in the Language of Social Media: The Open-Vocabulary Approach](https://doi.org/10.1371/journal.pone.0073791)  | Historical `phughesmcr/bigfive/data/lexicon.json`                          |
| Dark Triad           | Preoţiuc-Pietro, Carpenter, Giorgi and Ungar (2016), [Studying the Dark Triad of Personality through Twitter Behavior](https://doi.org/10.1145/2983323.2983822)     | Historical `phughesmcr/darktriad/data/lexicon.json`                        |
| Optimism             | Experimental combination from the historical optimismo package, using affect and future-term vocabularies                                                           | Historical future-term allowlist intersected with canonical affect weights |

The canonical CSVs are from [wwbp/lexica](https://github.com/wwbp/lexica). Older
package citations incorrectly identified the age/gender coefficients with the
2013 personality paper; the canonical age/gender release cites Sap et al.
(2014).

## Feature extraction

The studies extracted features with DLATK (pinned at `dlatk/dlatk@a24a0dd`).
`tokenize` ports its message cleaning (newlines become `<newline>`, runs of five
or more dots become `....`) and the Happier Fun Tokenizer (HFT), lowercased,
with Python’s Unicode `\s`, `\w` and `\d` classes, HTML entity decoding
(including the double-decoding of `&amp;`), `\xNN` escape removal and
`<non-utf8>` handling. It matches the pinned Python on the committed fixture,
which includes 300 seeded fuzz strings, and matched it on 25,000 further fuzzed
strings during development.

Scoring follows DLATK’s `addNGramTable` and `addLexiconFeat`. Ngrams never span
messages. Frequency encoding divides each matched ngram’s count by the number of
ngrams of the same size in the group (`group_norm`), so unigrams are divided by
token count and bigrams by bigram count. A user is the group: pass their
messages as an array of token arrays. Intercepts and supplied structural
covariates are added afterwards.

Known differences from DLATK:

- DLATK stores grams in VARCHAR columns that truncate unigrams, bigrams and
  trigrams to 36, 70 and 102 characters. Truncation is not ported; longer grams
  are kept intact and cannot match the truncated forms.
- Numeric HTML entities (`&#…;`) are decoded only when written with ASCII
  digits. Python also accepts other Unicode decimal digits.
- Unicode character classes follow the JavaScript engine’s Unicode version,
  which can differ from the Python version used for training.

## What is preserved and changed

`data/provenance.json` pins each imported source by full Git commit, path and
SHA-256. All canonical CSV coefficients retain their original numeric precision.
Category names map to historical API names; `_intercept` becomes intercept
metadata. Only the four named PERMA structural covariates are separated; lexical
underscore terms remain vocabulary.

Vocabulary corrections, each listed in `data/provenance.json`:

- Terms HFT cannot produce are removed: PERMA spreadsheet errors `#NAME?`,
  `#REF!` and `Err:508`, whose original terms are unrecoverable; Big Five `''`,
  `' -'`, `': '`, `'the lord,'`, `'93.00%'` and `'0.93%'`.
- PERMA `TRUE`, a spreadsheet boolean conversion, is restored to `true`.
- UTF-8 terms mis-decoded as cp1252 are repaired in age, gender and PERMA, e.g.
  `â™¥` to `♥`.
- Backslashes doubled by export escaping in affect, age and gender terms are
  restored to single-backslash HFT tokens, e.g. `:\\` to `:\`.
- Big Five N weights are negated. Their historical signs described emotional
  stability, contrary to Schwartz et al. (2013), where terms such as `depressed`
  and `sick of` mark high neuroticism.

Each model enables the ngram sizes of its vocabulary as HFT tokenizes it. Spaced
dots (`. . .`) are one HFT token, so age and gender are unigram-only, as in Sap
et al. (2014). Temporal orientation defaults to binary encoding, following the
per-message binary ngram indicators of Schwartz et al. (2015) and Park et al.
(2016); its scores are one-vs-rest log-odds for a single message.

The Spanish CSV has intact accents and supersedes the corrupted legacy JSON. Big
Five weights otherwise remain the historical association weights, with no
assertion that they form a trained multivariate personality model.

The optimism model uses each historical future term once with its canonical
affect coefficient. Its intercept is the canonical affect intercept. This
composition was not independently trained or validated as an optimism model.

## Unresolved provenance

- Affect: Preoţiuc-Pietro et al. (2016) do not state the feature encoding. The
  default remains frequency; binary sums fall more plausibly within the 1–9
  rating scale. Treat the encoding as unverified.
- Dark Triad: scores are natural logs of the 1–5 questionnaire scale. The
  historical vocabulary has 20,507 unigrams, whereas the paper reports 6,491
  features, so these coefficients and intercepts cannot be traced to the
  published model.
- PERMA: the encoding and output scale of both English and Spanish models are
  unverified.

## Reproduction limits

Arithmetic, tokenizer and coefficients alone do not establish identical
predictions to a paper’s complete training pipeline. Message grouping,
anonymization (e.g. PERMA’s `@name_removed`), vocabulary version and domain must
match too.

English PERMA retains `_avg2gramLength`, `_avg3gramLength`, `_avg2gramsPerMsg`
and `_avg3gramsPerMsg` coefficients. Their values must come from the
study-compatible pipeline and units; the package does not infer or invent them.
DLATK defines `_avgNgramsPerMsg` as a user’s ngrams divided by messages and
`_avgNgramLength` as characters per ngram; its implementation also adds the last
gram’s length once more per message. Omitted structural contributions generate
warnings. English PERMA has no intercept rows in the imported CSV, so its
intercepts are zero. Spanish PERMA has explicit category intercepts, which are
retained.

Demographic and personality scores describe historical models’ associations with
language, not verified facts about an individual. The age/gender models reflect
the original datasets and historical binary labels. Their results have not been
calibrated for present-day platforms, populations or short texts. Linear scores
may be outside intuitive ranges and are not probabilities. Empty or unmatched
categories return null rather than an intercept-only result.

## Verification

`python3 scripts/import-data.py --check` fetches only pinned source files,
verifies hashes and regenerates every coefficient to compare with the bundle. It
executes no downloaded source code. Normal builds and tests are offline after
dependency installation.

`python3 scripts/dlatk-reference.py` is a development tool that regenerates
`test/dlatk-fixture.json`. It fetches the pinned, checksum-verified HFT,
executes it, and applies DLATK’s ngram and lexicon arithmetic to produce
reference tokens and scores.

The tests include the existing lex-helpers worked example, tokenizer and model
fixtures generated by the DLATK reference, Unicode/Spanish checks, intercepts
and supplied structural covariates, no-match behavior, prototype-like token
keys, immutable definitions and package imports. Reproducing research accuracy
would require the original datasets, evaluation splits and full feature
pipelines; that evaluation has not been performed.
