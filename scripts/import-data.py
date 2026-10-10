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
    entry = next(e for e in manifest['sources'] if e['repository'] == repository and e['path'] == path)
    url = f"https://raw.githubusercontent.com/{repository}/{entry['commit']}/{path}"
    with urllib.request.urlopen(url, timeout=30) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != entry['sha256']:
        raise ValueError(f'Checksum mismatch for {url}')
    return content.decode('utf-8')

models = {}
reserved = {'_avg2gramLength', '_avg3gramLength', '_avg2gramsPerMsg', '_avg3gramsPerMsg'}
configs = [
    ('affect', 'affect_intensity/affect_intensity_lexicon.csv', {'AFFECT_AVG': 'AFFECT', 'INTENSITY_AVG': 'INTENSITY'}, None),
    ('age', 'age_gender/emnlp14age.csv', {}, 'AGE'),
    ('gender', 'age_gender/emnlp14gender.csv', {}, 'GENDER'),
    ('temporal', 'temporal_orientation/temporal_orientation_lexicon.csv', {'PAST_OR_NOT': 'PAST', 'PRESENT_OR_NOT': 'PRESENT', 'FUTURE_OR_NOT': 'FUTURE'}, None),
    ('perma', 'perma/permaV3_dd.csv', {}, None),
    ('permaEs', 'spanish_perma/spanish_perma_v1.csv', {}, None),
]
for name, path, rename, single in configs:
    model = {'id': name, 'language': 'es' if name == 'permaEs' else 'en', 'encoding': 'frequency', 'ngrams': [], 'categories': {}, 'intercepts': {}, 'features': {}}
    for row in csv.DictReader(io.StringIO(fetch('wwbp/lexica', path))):
        category = single or rename.get(row['category'], row['category'])
        term, weight = row['term'], float(row['weight'])
        model['categories'].setdefault(category, {})
        model['intercepts'].setdefault(category, 0)
        if term == '_intercept':
            model['intercepts'][category] = weight
        elif term in reserved:
            model['features'].setdefault(category, {})[term] = weight
        else:
            model['categories'][category][term] = weight
    models[name] = model
for name, repository, encoding, intercepts in [
    ('bigFive', 'bigfive', 'binary', dict.fromkeys(['O', 'C', 'E', 'A', 'N'], 0)),
    ('darkTriad', 'darktriad', 'frequency', {'darktriad': 0.632024388686, 'machiavellianism': 0.596743883684, 'narcissism': 0.714881303759, 'psychopathy': 0.48892463341}),
]:
    models[name] = {'id': name, 'language': 'en', 'encoding': encoding, 'ngrams': [], 'categories': json.loads(fetch('phughesmcr/' + repository, 'data/lexicon.json')), 'intercepts': intercepts, 'features': {}}
# Export artefacts, listed in provenance.json. Removed terms cannot be produced by HFT.
excluded = {
    'perma': {'#NAME?', '#REF!', 'Err:508'},  # spreadsheet formula errors; originals unrecoverable
    'bigFive': {'', ' -', ': ', 'the lord,', '93.00%', '0.93%'},
}
renamed = {'perma': {'TRUE': 'true'}}  # spreadsheet boolean conversion

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
            term = renamed.get(name, {}).get(term) or repair(name, term)
            if term in fixed:
                raise ValueError(f'Repaired term collides: {name} {category} {term!r}')
            fixed[term] = weight
        model['categories'][category] = fixed
# Schwartz et al. (2013): 'depressed' and 'sick of' mark high neuroticism. The historical N
# weights had the opposite sign (emotional stability), so they are negated.
models['bigFive']['categories']['N'] = {term: -weight for term, weight in models['bigFive']['categories']['N'].items()}
# Schwartz et al. (2015) and Park et al. (2016) encode ngrams as binary per-message indicators.
models['temporal']['encoding'] = 'binary'
future = json.loads(fetch('phughesmcr/optimismo', 'data/future.json'))
affect = models['affect']['categories']['AFFECT']
models['optimism'] = {'id': 'optimism', 'language': 'en', 'encoding': 'binary', 'ngrams': [], 'categories': {'OPTIMISM': {term: affect[term] for term in future if term in affect}}, 'intercepts': {'OPTIMISM': models['affect']['intercepts']['AFFECT']}, 'features': {}}
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
