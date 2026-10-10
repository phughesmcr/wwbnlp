"""Rebuild bundled data from pinned public sources. stdlib only; no source code is executed."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'data/provenance.json').read_text())

def fetch(repository, path):
    entry = next(e for e in manifest['sources'] if e.get('repository') == repository and e['path'] == path)
    url = f"https://raw.githubusercontent.com/{repository}/{entry['commit']}/{path}"
    with urllib.request.urlopen(url, timeout=30) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != entry['sha256']:
        raise ValueError(f'Checksum mismatch for {url}')
    return content.decode('utf-8')

models = {}
reserved = {'_avg2gramLength', '_avg3gramLength', '_avg2gramsPerMsg', '_avg3gramsPerMsg'}

def add(name, rows):
    """Build a model from (category, term, weight) rows."""
    model = {'id': name, 'language': 'es' if name == 'permaEs' else 'en', 'encoding': 'frequency', 'aggregation': 'pool', 'ngrams': [], 'categories': {}, 'intercepts': {}, 'features': {}}
    for category, term, weight in rows:
        model['categories'].setdefault(category, {})
        model['intercepts'].setdefault(category, 0)
        if term == '_intercept':
            model['intercepts'][category] = weight
        elif term in reserved:
            model['features'].setdefault(category, {})[term] = weight
        elif term in model['categories'][category]:
            raise ValueError(f'Duplicate term: {name} {category} {term!r}')
        else:
            model['categories'][category][term] = weight
    models[name] = model

configs = [
    ('affect', 'affect_intensity/affect_intensity_lexicon.csv', {'AFFECT_AVG': 'AFFECT', 'INTENSITY_AVG': 'INTENSITY'}, None),
    ('age', 'age_gender/emnlp14age.csv', {}, 'AGE'),
    ('gender', 'age_gender/emnlp14gender.csv', {}, 'GENDER'),
    ('temporal', 'temporal_orientation/temporal_orientation_lexicon.csv', {'PAST_OR_NOT': 'PAST', 'PRESENT_OR_NOT': 'PRESENT', 'FUTURE_OR_NOT': 'FUTURE'}, None),
    ('perma', 'perma/permaV3_dd.csv', {}, None),
]
for name, path, rename, single in configs:
    rows = csv.DictReader(io.StringIO(fetch('wwbp/lexica', path)))
    add(name, ((single or rename.get(row['category'], row['category']), row['term'], float(row['weight'])) for row in rows))
# Spanish PERMA is DLATK's dd_sperma_v2 table, the version DLATK distributes (WWBP's
# spanish_perma_v1.csv is an earlier one). The MySQL dump is parsed, never executed.
sql = fetch('dlatk/dlatk', 'dlatk/data/dlatk_lexica.sql')
insert = re.search(r"^INSERT INTO `dd_sperma_v2` VALUES (.*);$", sql, re.M).group(1)
unescape = {'0': '\0', 'b': '\b', 'n': '\n', 'r': '\r', 't': '\t', 'Z': '\x1a'}
spanish = [
    (category, re.sub(r'\\(.)', lambda m: unescape.get(m.group(1), m.group(1)), term), float(weight))
    for term, category, weight in re.findall(r"\(\d+,'((?:[^'\\]|\\.)*)','(\w+)',(-?[\d.eE+-]+)\)", insert)
]
if len(spanish) != insert.count('),(') + 1:
    raise ValueError('Unparsed dd_sperma_v2 rows')
add('permaEs', spanish)
# The historical darktriad package hard-coded its intercepts in index.js; read, never executed.
block = re.search(r'define intercept values.*?\{(.*?)\}', fetch('phughesmcr/darktriad', 'index.js'), re.S).group(1)
darktriad_intercepts = {key: float(value) for key, value in re.findall(r'(\w+):\s*(-?[\d.]+)', block)}
for name, repository, encoding, intercepts in [
    ('bigFive', 'bigfive', 'binary', dict.fromkeys(['O', 'C', 'E', 'A', 'N'], 0)),
    ('darkTriad', 'darktriad', 'frequency', darktriad_intercepts),
]:
    models[name] = {'id': name, 'language': 'en', 'encoding': encoding, 'aggregation': 'pool', 'ngrams': [], 'categories': json.loads(fetch('phughesmcr/' + repository, 'data/lexicon.json')), 'intercepts': intercepts, 'features': {}}
if set(darktriad_intercepts) != set(models['darkTriad']['categories']):
    raise ValueError('Dark Triad intercepts do not match its categories')
# The Dark Triad weights are coefficients of standardized cluster fractions, shared by every
# word of a cluster. Un-standardize them as DLATK does when exporting a lexicon: divide by
# the cluster's SD and move mean/SD into the intercept. data/darktriad-scaling.json holds the
# released dataset's statistics (scripts/derive-darktriad-scaling.py; docs/research.md).
scaling = json.loads((root / 'data/darktriad-scaling.json').read_text())
dataset = next(e for e in manifest['sources'] if e.get('file') == 'darktriad.tar.gz')
if scaling['source']['sha256'] != dataset['sha256']:
    raise ValueError('Dark Triad scaling was derived from a different dataset')
statistics = {c['anchor']: c for c in scaling['clusters']}
unscaled = {c['anchor']: c for c in scaling['unmapped']}
for category, terms in models['darkTriad']['categories'].items():
    groups = {}
    for term, weight in terms.items():
        groups.setdefault(weight, []).append(term)
    for weight, group in groups.items():
        anchor = min(group)
        cluster = statistics.get(anchor) or unscaled[anchor]
        if cluster['words'] != len(group):
            raise ValueError(f'Dark Triad cluster {anchor!r} has changed size')
        if anchor in statistics:
            for term in group:
                terms[term] = weight / cluster['sd']
            models['darkTriad']['intercepts'][category] -= weight * cluster['mean'] / cluster['sd']
# "We recommend to use on users with at least 500 tokens" (READMEdtmodel.txt); the dataset
# kept users with more than 500. Standardized cluster weights make shorter texts erratic.
models['darkTriad']['minTokens'] = 500
# Export artefacts, listed in provenance.json. Removed terms cannot be produced by HFT.
excluded = {
    'perma': {'#NAME?', '#REF!', 'Err:508'},  # spreadsheet formula errors; originals unrecoverable
    'bigFive': {'93.00%', '0.93%'},  # spreadsheet percentage conversions; originals unrecoverable
}
renamed = {
    'perma': {'TRUE': 'true'},  # spreadsheet boolean conversion
    # Double quotes lost when WWBP's top-100 rmatrix CSVs were converted. HFT splits the comma
    # from 'lord', so 'the lord,' can only be the trigram 'the lord ,'.
    'bigFive': {'': '"', ' -': '" -', ': ': ': "', 'the lord,': 'the lord ,'},
}

def repair(name, term):
    if name in ('affect', 'age', 'gender'):
        term = term.replace('\\\\', '\\')  # backslashes doubled by export escaping
    try:  # UTF-8 bytes previously decoded as cp1252
        return bytes(ord(c) if ord(c) < 256 else c.encode('cp1252')[0] for c in term).decode('utf-8')
    except (UnicodeError, ValueError):
        return term

for name, model in models.items():
    for category, terms in model['categories'].items():
        fixed = {}
        for term, weight in terms.items():
            if term in excluded.get(name, ()):
                continue
            term = renamed[name][term] if term in renamed.get(name, {}) else repair(name, term)
            if term in fixed:
                raise ValueError(f'Repaired term collides: {name} {category} {term!r}')
            fixed[term] = weight
        model['categories'][category] = fixed
# Schwartz et al. (2013): 'depressed' and 'sick of' mark high neuroticism. The historical N
# weights had the opposite sign (emotional stability), so they are negated.
models['bigFive']['categories']['N'] = {term: -weight for term, weight in models['bigFive']['categories']['N'].items()}
# Message-level models use binary per-message ngram indicators: PERMA (Schwartz et al. 2016,
# section 4.1; Smith et al. 2016, section 3.2), temporal orientation (Schwartz et al. 2015;
# Park et al. 2016) and affect (inferred from its Table 1; see docs/research.md).
# A user's PERMA score is the mean of their message predictions (Schwartz et al. 2016,
# section 4.3), and so is affect's (the package's choice); their temporal
# orientation is the proportion of their messages classified as each class.
for name, aggregation in [('affect', 'mean'), ('perma', 'mean'), ('permaEs', 'mean'), ('temporal', 'argmax')]:
    models[name]['encoding'], models[name]['aggregation'] = 'binary', aggregation
# HFT keeps spaced dots ('. . .') as one token.
for model in models.values():
    model['ngrams'] = sorted({len(re.findall(r'\.(?:\s*\.)+|[^ ]+', term)) for terms in model['categories'].values() for term in terms})
content = json.dumps(models, ensure_ascii=False, indent=2) + '\n'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Verify without modifying bundled data')
args = parser.parse_args()
target = root / 'data/models.json'
if args.check:
    if content != target.read_text():
        raise ValueError('Bundled models differ from pinned sources')
    print('All bundled weights and intercepts match pinned, checksum-verified sources.')
else:
    target.write_text(content)
    print('Rebuilt', target)
