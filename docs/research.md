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
| Spanish PERMA        | Smith et al. (2016), [Does ‘well-being’ translate on Twitter?](https://aclanthology.org/D16-1217/)                                                                                                                            | DLATK `dd_sperma_v2` (`dlatk/data/dlatk_lexica.sql`)                                                                                 |
| Big Five             | Schwartz et al. (2013), [Personality, Gender, and Age in the Language of Social Media: The Open-Vocabulary Approach](https://doi.org/10.1371/journal.pone.0073791)                                                            | Historical `phughesmcr/bigfive/data/lexicon.json`, a copy of WWBP’s `{O,C,E,A,N}.top100.1to3grams.gender_age_controlled.rmatrix.csv` |
| Dark Triad           | Preoţiuc-Pietro, Carpenter, Giorgi and Ungar (2016), [Studying the Dark Triad of Personality through Twitter Behavior](https://doi.org/10.1145/2983323.2983822)                                                               | Historical `phughesmcr/darktriad/data/lexicon.json` and `index.js`, rescaled with the authors’ released dataset                      |
| Optimism             | [WWBP lexica guidance](https://www.wwbp.org/lexica): “Combining the affect lexicon with the future orientation lexicon produces an optimism lexicon (positive future-oriented thinking)”                                      | WWBP temporal orientation and affect lexica (no separate coefficients)                                                               |

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

| Model                             | Unit                   | Encoding  | Group of messages (`aggregation`)                              |
| --------------------------------- | ---------------------- | --------- | -------------------------------------------------------------- |
| PERMA, Spanish PERMA              | Message                | binary    | `mean` of message predictions (Schwartz et al. 2016, §4.3)     |
| Affect/intensity                  | Message                | binary    | `mean` of message predictions                                  |
| Temporal orientation              | Message                | binary    | `argmax`: share of messages classified as each class           |
| Optimism                          | Message                | binary    | future-oriented messages (temporal argmax), then `mean` affect |
| Age, gender, Big Five, Dark Triad | User (one DLATK group) | see below | `pool`: one DLATK group over all of a user’s messages          |

- **PERMA**: “n-grams are encoded as booleans (i.e., whether they exist or not
  in the message)” (Schwartz et al. 2016, §4.1). Their cascaded user model uses
  “the mean prediction across a user’s messages” (§4.3). Smith et al. (2016,
  §3.2) also use per-tweet presence. Message ratings are 0–6 (English) and 1–7
  (Spanish). English PERMA has no intercept rows; Spanish PERMA does.
- **Temporal orientation**: user-level orientation “is trivially defined:
  percentage of a given user’s messages that are classified as past, present, or
  future oriented” (Schwartz et al. 2015); Park et al. (2016) likewise divide
  each class’s message count by the user’s total. A message’s class is the
  category with the highest one-vs-rest score, intercepts included; exact ties
  share the message equally. The released lexicon is the logistic regression
  model. Schwartz et al. (2015) and Park et al. (2016) classified with extremely
  randomized trees, which are not part of the lexica release (Schwartz et al.
  pointed to wwbp.org/data.html for that classifier).
- **Affect**: Preoţiuc-Pietro et al. (2016) say only that they “train two linear
  regression models with ℓ2 regularisation” on a bag-of-words representation of
  each post; they state no encoding, normalisation or tokenizer, and never
  combine several posts (averaging is this package’s choice). Binary is
  inferred. Under relative frequency a post’s valence stays within about 4.8–5.3
  on the 1–9 scale. For all four rated posts in their Table 1, binary sums are
  closer to the ratings: valence 3.80 versus 4.85 (frequency) for “the boring
  life is back :( …” (rated 3), 5.83 versus 5.15 for “Blessed with a baby boy
  today …” (7.5), and arousal 6.12 versus 4.37 for a post rated 8. Valence runs
  from 1 (very negative) through 5 (neutral) to 9 (very positive); arousal from
  1 (neutral, no arousal) to 9 (very high).
- **Age and gender**: Sap et al. (2014) use relative unigram frequencies over
  each user’s messages, `intercept + Σ weight × freq(word)`. Age is in years.
  Gender is a classifier margin: `≥ 0` is the source’s female label, `< 0` male.
  Facebook and blog training users had written at least 1,000 words; shorter
  samples are outside that range. No threshold is stated for the Twitter users
  in the gender training data.
- **Big Five**: the weights are age- and gender-controlled correlations from
  Schwartz et al. (2013), who regress each trait on one 1–3gram at a time with
  age and gender as covariates and take the standardized coefficient as the
  correlation. The selection of each trait’s 100 most positive and 100 most
  negative terms comes from WWBP’s `top100` rmatrix files, which the weights
  match exactly except where noted below. They are single-term associations, not
  a joint predictive model, so scores are association sums (binary over a user’s
  pooled messages; the paper used Anscombe-transformed relative frequencies),
  not calibrated trait predictions.
- **Dark Triad**: frequency over a user’s pooled messages, with the weights
  rescaled as described in [Dark Triad scaling](#dark-triad-scaling).

With `mean` and `argmax`, every nonempty message is predicted, and a message
without any matched term predicts its intercepts, as in the PERMA and temporal
papers. If no message in the input matches any term, the result is `null`
(unknown) rather than intercept-only. `messageValues` returns the per-message
scores.

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
  trigrams to 36, 70 and 102 characters. Truncation is not ported, but no
  bundled term reaches those lengths, so it cannot change a bundled score
  (tested).
- `addLexiconFeat` writes no row for a category without matches; this package
  scores every category once any category matches (above).
- DLATK’s lexicon extraction reads the 1gram table by default, so multi-word
  terms only match when a 1to3gram table is supplied. This package matches every
  ngram size present in each vocabulary.
- DLATK treats a lexicon term ending in `*` as a prefix wildcard, so `*` alone
  would match every unigram. Terms such as `*`, `f *` and `* - *` (in affect,
  age, gender, temporal, PERMA and Big Five) are HFT ngrams of the trained
  models and are matched literally: `f you` does not match `f *` (tested).
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
et al. (2014).

Spanish PERMA is DLATK’s `dd_sperma_v2` table, parsed from the MySQL dump DLATK
distributes (`dlatk/data/dlatk_lexica.sql`). WWBP’s `spanish_perma_v1.csv` is an
earlier version: 1,392 of its 2,249 terms are absent from v2, which adds 1,901
others; 857 shared weights differ, and so do the intercepts (e.g. POS_P 2.68 vs
3.38). Neither file says which one Smith et al. (2016) report; v2 is the one
DLATK ships. Its accents are intact, superseding the corrupted legacy JSON.

Optimism follows WWBP’s guidance for combining two of its lexica: “Simply filter
messages to those future-oriented using the future orientation lexicon, then
apply the affect lexicon.” Each message is classified with the temporal
orientation lexicon, as in Schwartz et al. (2015): it is future-oriented when
FUTURE is its highest one-vs-rest score, intercepts included. The affect lexicon
then scores those messages (binary, intercept included), and OPTIMISM is their
mean valence on the 1–9 scale. Messages that are not future-oriented have `null`
in `messageValues`; with none, the result is `no-matches`. Options apply to the
affect step. WWBP do not report validating this combination, and it has no
separate coefficients. The historical optimismo package instead summed affect
weights over a fixed term list, the whole temporal FUTURE vocabulary including
past-indicating terms such as `was` and `last night`; that list is no longer
used.

## Dark Triad scaling

Preoţiuc-Pietro et al. (2016) predict the natural logarithm of each 1–5 Dirty
Dozen trait score, and of their mean, with scikit-learn elastic-net regression.
One feature set is 200 word2vec clusters, where a cluster feature is “the
fraction of the words belonging to that cluster”. The historical lexicon expands
those coefficients to words: each trait has 18–91 distinct weights, each shared
by every word of one cluster (e.g. one 152-word cluster containing `hot`, `sex`,
`naked` and `porn`).

The authors’ instructions for the released word models
([READMEdtmodel.txt](https://web.archive.org/web/20190921091639/https://www.sas.upenn.edu/~danielpr/READMEdtmodel.txt))
are to “extract the fraction of occurence of each token in a user’s tweets.
Then, multiply these occurences with the weights assigned to each word from our
model and, finally, add the ‘_intercept’ value”; the result is “the natural
logarithm for each trait”. Applied that way, the weights cannot be coefficients
of raw cluster fractions:

- In the authors’ released dataset of 491 users, cluster fractions have standard
  deviations of 0.0002–0.015 (median 0.0015). With weights of at most 0.037,
  every released user scores within ±0.002 of the intercepts (about 1.88 on the
  1–5 scale for the aggregate score), whereas the paper reports cross-validated
  r ≈ .2 for clusters.
- Elastic-net fits to the released cluster features, at the lexicon’s sparsity,
  have largest coefficients of 0.016–0.050 on standardized features and 0.8–16
  on raw fractions. The lexicon’s 0.021–0.037 is on the standardized scale.
- When DLATK exports a lexicon it divides standardized coefficients by each
  feature’s SD and moves the means into the intercept. As raw-scale weights
  these would be in the tens.

The package therefore un-standardizes them in the same way. Each word’s weight
is divided by its cluster’s SD, and Σ weight × mean / SD is subtracted from the
intercept. `scripts/derive-darktriad-scaling.py` identifies each lexicon cluster
among the dataset’s 200 cluster columns. For every user, the summed frequency of
the cluster’s words in the dataset’s unigram table cannot exceed the cluster
fraction; among the columns that satisfy this, the most correlated one is chosen
(median r = .94; all 102 assignments are distinct). The means and population SDs
(as scikit-learn’s `StandardScaler`) over all 491 users are stored in
`data/darktriad-scaling.json`, with the dataset’s SHA-256. Rescaled, the
released users score 1.4–2.3 (aggregate, Machiavellianism, psychopathy) and
1.05–3.35 (narcissism) on the 1–5 scale.

Limitations:

- The model was fitted on cross-validation training folds, not all 491 users, so
  its scaling statistics differed slightly. The historical intercepts are within
  0.02 of the 491 users’ mean log scores, as expected for standardized features.
- Six clusters are identified from few common words (r = .31–.49); `aap`’s
  cluster (r = .31) is the least certain.
- Two narcissism clusters, of names (`ahmed`, `ali`; 123 words) and of laughter
  (`ahahaha`; 105 words), have no words in the dataset’s unigram table. They
  cannot be identified and keep their original weights, which contribute almost
  nothing.
- The dataset’s outcomes do not line up with its feature rows. Its outcomes
  reproduce the paper’s demographic correlations (e.g. r = .22 between male
  gender and psychopathy, paper .21), but gender, the strongest known language
  signal, is at chance in the text features: no unigram correlates beyond |r| =
  .16, and `omg`, `<3` and `boyfriend` lean male. Scores therefore cannot be
  validated against the questionnaire, in either scaling.
- The paper evaluates predictions of residuals after age and gender adjustment
  (§6); the released models’ intercepts are on the unadjusted log scale.
- The paper used “a Twitter-specific tokenizer”; the authors recommend HFT for
  the released models, and use on users with at least 500 tokens. With
  standardized weights short texts give extreme values (one word can exceed
  10¹¹), so `analyse` warns below 500 tokens.

## Reproduction limits

Arithmetic, tokenizer and coefficients alone do not establish identical
predictions to a paper’s complete training pipeline. Message grouping,
anonymization (e.g. PERMA’s `@name_removed`), vocabulary version and domain must
match too. PERMA’s message models were evaluated with ngrams, topics and lexica;
only the ngram lexicon is distributed. Schwartz et al. (2016) state that
unigrams and bigrams were used, yet the released English CSV contains 772
three-token terms; they are retained.

English PERMA retains `_avg2gramLength`, `_avg3gramLength`, `_avg2gramsPerMsg`
and `_avg3gramsPerMsg` coefficients. Schwartz et al. (2016) do not mention them;
their message features are ngrams, topics and lexica. When DLATK extracts ngrams
it also writes these values to a separate `meta_` table: for one message,
`_avgNgramsPerMsg` is the number of n-grams and `_avgNgramLength` the characters
per n-gram, with the last n-gram counted twice. Within every category,
`_avg3gramLength` and `_avg3gramsPerMsg` have identical weights, as do the
bigram pair where present. Two different measurements are unlikely to receive
identical ridge coefficients, which points to an export artefact.

DLATK itself never applies these rows. Its own copy of the lexicon (`dd_permaV3`
in `dlatk/data/dlatk_lexica.sql`) is identical to the CSV, with the same pairs
and no `_intercept` rows. `addLexiconFeat` only looks up the terms that occur in
the ngram table it is given, and the `_avg` values are never in that table.
Applying the released lexicon with DLATK therefore gives the lexical sum without
intercepts, which is what this package computes. Computing the features from a
message would instead add about 1–7 points and push ordinary posts outside the
0–6 scale (e.g. 8.8 for positive relationships in a birthday message, 7.4 for
engagement in “check this out” followed by a link). They can be supplied via
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

`python3 scripts/derive-darktriad-scaling.py darktriad.tar.gz` regenerates
`data/darktriad-scaling.json` from the authors’ released Dark Triad dataset,
which is checksum-verified and read without extraction. The dataset is not
fetched; the committed statistics are what `import-data.py` applies.

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
