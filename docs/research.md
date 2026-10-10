# Research methods and data provenance

This package consolidates historical lexicon implementations. It verifies
coefficient provenance and arithmetic, not the full empirical findings of the
original papers. Tests do not establish out-of-domain accuracy or reproduce
cross-validation results.

## Published sources

| Model                | Research source                                                                                                                                                                                                               | Coefficient source                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Affect/intensity     | Preoţiuc-Pietro et al. (2016), [Modelling Valence and Arousal in Facebook posts](https://aclanthology.org/W16-0404/)                                                                                                          | WWBP `affect_intensity/affect_intensity_lexicon.csv`                                                                                 |
| Age/gender           | Sap et al. (2014), [Developing Age and Gender Predictive Lexica over Social Media](https://aclanthology.org/D14-1121/)                                                                                                        | WWBP `age_gender/emnlp14age.csv` and `emnlp14gender.csv`                                                                             |
| Temporal orientation | Schwartz et al. (2015), [Extracting Human Temporal Orientation from Facebook Language](https://aclanthology.org/N15-1044/); Park et al. (2016), [Living in the Past, Present, and Future](https://doi.org/10.1111/jopy.12239) | WWBP `temporal_orientation/temporal_orientation_lexicon.csv`                                                                         |
| English PERMA        | Schwartz et al. (2016), [Predicting Individual Well-Being Through the Language of Social Media](https://psb.stanford.edu/psb-online/proceedings/psb16/schwartz.pdf)                                                           | WWBP `perma/permaV3_dd.csv`                                                                                                          |
| Spanish PERMA        | Smith et al. (2016), [Does ‘well-being’ translate on Twitter?](https://aclanthology.org/D16-1217/)                                                                                                                            | WWBP `spanish_perma/spanish_perma_v1.csv`                                                                                            |
| Big Five             | Schwartz et al. (2013), [Personality, Gender, and Age in the Language of Social Media: The Open-Vocabulary Approach](https://doi.org/10.1371/journal.pone.0073791)                                                            | Historical `phughesmcr/bigfive/data/lexicon.json`, a copy of WWBP’s `{O,C,E,A,N}.top100.1to3grams.gender_age_controlled.rmatrix.csv` |
| Dark Triad           | Preoţiuc-Pietro, Carpenter, Giorgi and Ungar (2016), [Studying the Dark Triad of Personality through Twitter Behavior](https://doi.org/10.1145/2983323.2983822)                                                               | Historical `phughesmcr/darktriad/data/lexicon.json`; intercepts from its `index.js`                                                  |
| Optimism             | Experimental combination from the historical optimismo package, using affect and future-term vocabularies                                                                                                                     | Historical future-term allowlist, restricted to positive temporal FUTURE weights, with canonical affect weights                      |

Park, G., Schwartz, H. A., Sap, M., Kern, M. L., Weingarten, E., Eichstaedt, J.
C., Berger, J., Stillwell, D. J., Kosinski, M., Ungar, L. H., & Seligman, M. E.
P. (2017). Living in the past, present, and future: Measuring temporal
orientation with language. _Journal of Personality, 85_(2), 270–280.
https://doi.org/10.1111/jopy.12239 (online 2016).

The canonical CSVs are from [wwbp/lexica](https://github.com/wwbp/lexica). Older
package citations incorrectly identified the age/gender coefficients with the
2013 personality paper; the canonical age/gender release cites Sap et al.
(2014).

## Message-level and user-level models

Each model is applied at the level at which it was trained:

| Model                             | Unit                   | Encoding  | Group of messages (`aggregation`)                          |
| --------------------------------- | ---------------------- | --------- | ---------------------------------------------------------- |
| PERMA, Spanish PERMA              | Message                | binary    | `mean` of message predictions (Schwartz et al. 2016, §4.1) |
| Affect/intensity                  | Message                | binary    | `mean` of message predictions                              |
| Temporal orientation              | Message                | binary    | `argmax`: share of messages classified as each class       |
| Optimism                          | Message                | binary    | `mean` (follows affect)                                    |
| Age, gender, Big Five, Dark Triad | User (one DLATK group) | see below | `pool`: one DLATK group over all of a user’s messages      |

- **PERMA**: “n-grams are encoded as booleans (i.e. whether they exist or not in
  the message)” (Schwartz et al. 2016, §4.1). Their cascaded user model uses
  “the mean prediction across a user’s messages”. Smith et al. (2016, §3.2) also
  use per-tweet presence. Message ratings are 0–6 (English) and 1–7 (Spanish).
  English PERMA has no intercept rows; Spanish PERMA does.
- **Temporal orientation**: user-level orientation “is trivially defined:
  percentage of a given user’s messages that are classified as past, present, or
  future oriented” (Schwartz et al. 2015); Park et al. (2016) likewise divide
  each class’s message count by the user’s total. A message’s class is the
  category with the highest one-vs-rest score, intercepts included; exact ties
  share the message equally. The released lexicon is the logistic regression
  model; Park et al. classified with an extremely randomized trees model, which
  is not distributed.
- **Affect**: Preoţiuc-Pietro et al. (2016) do not state the feature encoding.
  Binary is inferred. Under relative frequency a post’s valence stays within
  about 4.8–5.3 on the 1–9 scale. For all four rated posts in their Table 1,
  binary sums are closer to the ratings: valence 3.80 versus 4.85 (frequency)
  for “the boring life is back :( …” (rated 3), 5.83 versus 5.15 for “Blessed
  with a baby boy today …” (7.5), and arousal 6.12 versus 4.37 for a post rated
  8. Valence runs from 1 (very negative) through 5 (neutral) to 9 (very
  positive); arousal from 1 (neutral, no arousal) to 9 (very high).
- **Age and gender**: Sap et al. (2014) use relative unigram frequencies over
  each user’s messages, `intercept + Σ weight × freq(word)`. Age is in years.
  Gender is a classifier margin: `≥ 0` is the source’s female label, `< 0` male.
  Training users had written at least 1,000 words; shorter samples are outside
  that range.
- **Big Five**: the weights are WWBP’s age- and gender-controlled correlations
  (r) of each trait’s 100 most positive and 100 most negative 1–3grams, from
  Schwartz et al. (2013). They match WWBP’s rmatrix files exactly except where
  noted below. They are univariate associations, not regression coefficients, so
  scores are association sums (binary over a user’s pooled messages), not
  calibrated trait predictions.
- **Dark Triad**: see [Unresolved provenance](#unresolved-provenance).

With `mean` and `argmax`, every nonempty message is predicted, and a message
without any matched term predicts its intercepts, as in the papers. If no
message in the input matches any term, the result is `null` (unknown) rather
than intercept-only. `messageValues` returns the per-message scores.

## Feature extraction

The studies extracted features with DLATK (pinned at `dlatk/dlatk@a24a0dd`) or
its predecessor pipeline. `tokenize` ports DLATK’s message cleaning (newlines
become `<newline>`, runs of five or more dots become `....`) and the Happier Fun
Tokenizer (HFT), lowercased, with Python’s Unicode `\s`, `\w` and `\d` classes,
HTML entity decoding (including the double-decoding of `&amp;` and numeric
entities written in any Unicode decimal digits), `\xNN` escape removal and
`<non-utf8>` handling. It matches the pinned Python on the committed fixture,
which includes 300 seeded fuzz strings, and matched it on 73,734 further fuzzed
strings during development.

Scoring follows DLATK’s `addNGramTable` and `addLexiconFeat`. Ngrams never span
messages. Frequency encoding divides each matched ngram’s count by the number of
ngrams of the same size in the group (`group_norm`), so unigrams are divided by
token count and bigrams by bigram count. Binary encoding adds each matched
term’s weight once per group. Intercepts and supplied structural covariates are
added afterwards. A model’s categories share one feature space, so once any
category has a match, every category is scored, intercept included.

Known differences from DLATK:

- DLATK stores grams in VARCHAR columns that truncate unigrams, bigrams and
  trigrams to 36, 70 and 102 characters. Truncation is not ported; longer grams
  are kept intact and cannot match the truncated forms.
- `addLexiconFeat` writes no row for a category without matches; this package
  scores every category once any category matches (above).
- DLATK’s lexicon extraction reads the 1gram table by default, so multi-word
  terms only match when a 1to3gram table is supplied. This package matches every
  ngram size present in each vocabulary.
- DLATK treats a lexicon term ending in `*` as a prefix wildcard. PERMA’s
  `....
  *` and `* - *` are literal HFT ngrams of the trained model and are
  matched literally.
- `percent` encoding (matched candidate occurrences divided by all candidates)
  is a historical convenience of this package, not a DLATK measure.
- Unicode character classes follow the JavaScript engine’s Unicode version,
  which can differ from the Python version used for training.

The age/gender vocabulary contains no `<newline>` token, although 10,797 terms
were retained, so line breaks were probably not tokenized in that 2014 pipeline.
With this tokenizer each line break adds one unmatched unigram to the
denominator. Replacing line breaks with spaces before tokenizing text for `age`
and `gender` is closer to the published vocabulary.

## What is preserved and changed

`data/provenance.json` pins each imported source by full Git commit, path and
SHA-256. All coefficients retain their original numeric precision. Category
names map to historical API names; `_intercept` becomes intercept metadata. Only
the four named PERMA structural covariates are separated; lexical underscore
terms remain vocabulary.

Vocabulary corrections, each listed in `data/provenance.json`:

- Spreadsheet artefacts HFT cannot produce are removed: PERMA `#NAME?`, `#REF!`
  and `Err:508` (probably `=` emoticons such as `=)`, which spreadsheets parse
  as formulas; unrecoverable), and Big Five E `93.00%` and `0.93%` (percentage
  conversions; unrecoverable).
- PERMA `TRUE`, a spreadsheet boolean conversion, is restored to `true`.
- Big Five double quotes lost in the historical conversion are restored from
  WWBP’s rmatrix CSVs: O `"`, `" -` (r = .122, the second-strongest Openness
  term) and `: "`. A `the lord,` cannot be an HFT bigram, because HFT splits the
  comma from `lord`; it is restored as the trigram `the lord ,`.
- UTF-8 terms mis-decoded as cp1252 are repaired in age, gender and PERMA, e.g.
  `â™¥` to `♥`.
- Backslashes doubled by export escaping in affect, age and gender terms are
  restored to single-backslash HFT tokens, e.g. `:\\` to `:\`.
- Big Five N weights are negated. WWBP’s `neu` rmatrix column is oriented
  towards emotional stability (`depressed` and `sick of` are negative), whereas
  N names neuroticism, as in Schwartz et al. (2013). All 200 N terms match WWBP
  with every sign flipped.

Each model enables the ngram sizes of its vocabulary as HFT tokenizes it. Spaced
dots (`. . .`) are one HFT token, so age and gender are unigram-only, as in Sap
et al. (2014). The Spanish CSV has intact accents and supersedes the corrupted
legacy JSON.

The optimism model takes the historical future-term list, which was the whole
temporal FUTURE vocabulary, and keeps only the 129 terms with a positive FUTURE
weight; the other 112 (`was`, `did`, `last night`, …) indicate the past or
present. Each keeps its canonical affect coefficient. The score is a partial
affect sum over future-indicating terms, so no intercept is added: it is
relative, centred on zero, and not on the 1–9 valence scale. This composition
was not independently trained or validated as an optimism model.

## Unresolved provenance

- **Dark Triad**: the weights are traceable to the paper’s 200 word2vec word
  clusters. Each trait has only 18–91 distinct weights, each shared by every
  word of one cluster (e.g. one 152-word cluster containing `hot`, `sex`,
  `naked` and `porn`, weighted 0.0217 for the aggregate score). Because a
  cluster feature is “the fraction of the words belonging to that cluster”,
  frequency encoding over a user’s pooled messages is the correct arithmetic.
  However, the largest absolute weight is 0.037, so a score cannot move more
  than a few hundredths from its intercept. The coefficients were probably
  fitted to standardized cluster features, and the means and standard deviations
  needed to apply them are not available. The paper predicts each trait’s
  residual after adjusting for age and gender, whereas the intercepts
  (0.49–0.71) are on the historical package’s natural-log scale of the 1–5
  questionnaire. Treat scores as uncalibrated and use them only for relative
  comparisons within one corpus.
- **PERMA structural covariates**: see below.

## Reproduction limits

Arithmetic, tokenizer and coefficients alone do not establish identical
predictions to a paper’s complete training pipeline. Message grouping,
anonymization (e.g. PERMA’s `@name_removed`), vocabulary version and domain must
match too. PERMA’s message models were evaluated with ngrams, topics and lexica;
only the ngram lexicon is distributed. Schwartz et al. (2016) state that
unigrams and bigrams were used, yet the released English CSV contains 772
three-token terms; they are retained.

English PERMA retains `_avg2gramLength`, `_avg3gramLength`, `_avg2gramsPerMsg`
and `_avg3gramsPerMsg` coefficients. For a message-level model DLATK computes
them from each message: `_avgNgramsPerMsg` is the message’s number of n-grams,
and `_avgNgramLength` its characters per n-gram, with the last n-gram counted
twice. Within every category, `_avg3gramLength` and `_avg3gramsPerMsg` have
identical weights, as do the bigram pair where present. Two different
measurements are unlikely to receive identical ridge coefficients, which points
to an export artefact. Computing both from a message adds about 1–7 points and
pushes ordinary posts outside the 0–6 scale (e.g. 8.8 for positive relationships
in a birthday message, 7.4 for engagement in “check this out” followed by a
link). The package therefore does not compute them. They can be supplied via
`features`; with `mean` aggregation, supply each feature’s mean over the scored
messages, which is equivalent because the model is linear. Omitted structural
contributions generate warnings.

Demographic and personality scores describe historical models’ associations with
language, not verified facts about an individual. The age/gender models reflect
the original datasets and historical binary labels. Their results have not been
calibrated for present-day platforms, populations or short texts. Linear scores
may be outside intuitive ranges and are not probabilities. Input with no match
in any category returns null rather than an intercept-only result.

## Verification

`python3 scripts/import-data.py --check` fetches only pinned source files,
verifies hashes and regenerates every coefficient to compare with the bundle. It
executes no downloaded source code. Normal builds and tests are offline after
dependency installation.

`python3 scripts/dlatk-reference.py` is a development tool that regenerates
`test/dlatk-fixture.json`. It fetches the pinned, checksum-verified HFT,
executes it, and independently applies DLATK’s ngram and lexicon arithmetic and
each paper’s message aggregation to produce reference tokens and scores. It
reimplements DLATK’s arithmetic rather than running DLATK, so it checks the port
against a separate implementation of the same reading of the papers.

The tests include the existing lex-helpers worked example, tokenizer and model
fixtures generated by the reference, message-level aggregation, Unicode/Spanish
checks, intercepts and supplied structural covariates, no-match behavior,
prototype-like token keys, immutable definitions and package imports.
Reproducing research accuracy would require the original datasets, evaluation
splits and full feature pipelines; that evaluation has not been performed.
