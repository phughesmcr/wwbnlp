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

The canonical CSVs are from [wwbp/lexica](https://github.com/wwbp/lexica). Its
Spanish README explicitly distinguishes the Spanish-trained model and instructs
adding the supplied intercept after weighted extraction. Older package citations
incorrectly identified the age/gender coefficients with the 2013 personality
paper; the canonical age/gender release cites Sap et al. (2014).

## What is preserved and changed

`data/provenance.json` pins each imported source by full Git commit, path and
SHA-256. All canonical CSV coefficients retain their original numeric precision.
Category names map to historical API names; `_intercept` becomes intercept
metadata. Only the four named PERMA structural covariates are separated; lexical
underscore terms remain vocabulary.

The Spanish CSV has intact accents and supersedes the corrupted legacy JSON. The
Big Five historical O category contains an empty term with weight 0.078492; that
invalid term is excluded. Big Five weights otherwise remain the historical
association weights, with no assertion that they form a trained multivariate
personality model. Dark Triad retains the old coefficients and intercepts; these
intercepts come from the historical implementation, not an independently
verified re-training.

The optimism model uses each historical future term once with its canonical
affect coefficient. Its intercept is the canonical affect intercept. This
composition was not independently trained or validated as an optimism model.

Each model enables the ngram sizes present in its vocabulary. This includes
phrase features that the old age/gender wrappers omitted. Frequency weighting
divides occurrences by original token count, including unmatched tokens;
intercepts and supplied structural covariates are added afterwards.

## Reproduction limits

The tokenizer is a documented convenience implementation. Passing exact tokens
removes that preprocessing difference, but arithmetic and coefficients alone do
not establish identical features or predictions to a paper’s complete training
pipeline. Features, normalization, message grouping, vocabulary version and
domain must match too.

English PERMA retains `_avg2gramLength`, `_avg3gramLength`, `_avg2gramsPerMsg`
and `_avg3gramsPerMsg` coefficients. Their values must come from the
study-compatible pipeline and units; the package does not infer or invent them.
Omitted structural contributions generate warnings. English PERMA has no
intercept rows in the imported CSV, so its intercepts are zero. Spanish PERMA
has explicit category intercepts, which are retained.

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

The tests include the existing lex-helpers worked example, explicit-token model
fixtures independently calculated in Python, Unicode/Spanish checks, intercepts
and supplied structural covariates, no-match behavior, prototype-like token
keys, immutable definitions and package imports. Reproducing research accuracy
would require the original datasets, evaluation splits and full feature
pipelines; that evaluation has not been performed.
