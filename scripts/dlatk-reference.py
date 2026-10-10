"""Regenerate test/dlatk-fixture.json from the original Happier Fun Tokenizer and DLATK's
ngram and weighted-lexicon arithmetic. Development only: unlike import-data.py, this
executes the pinned, checksum-verified upstream tokenizer (see data/provenance.json).

DLATK reference (featureExtractor.addNGramTable and addLexiconFeat): each message is
cleaned (newlines -> <NEWLINE>, shrinkSpace), HFT-tokenized and lowercased; n-grams
never span messages; group_norm = count / (all n-grams of that size in the group); a
weighted lexicon adds intercept + sum(weight * group_norm). Binary uses presence.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import random
import re
import tempfile
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'data/provenance.json').read_text())
entry = next(e for e in manifest['sources'] if e['path'] == 'dlatk/lib/happierfuntokenizing.py')
url = f"https://raw.githubusercontent.com/{entry['repository']}/{entry['commit']}/{entry['path']}"
with urllib.request.urlopen(url, timeout=30) as response:
    source = response.read()
if hashlib.sha256(source).hexdigest() != entry['sha256']:
    raise ValueError(f'Checksum mismatch for {url}')
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'happierfuntokenizing.py'
    path.write_bytes(source)
    spec = importlib.util.spec_from_file_location('happierfuntokenizing', path)
    hft = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hft)
tokenizer = hft.Tokenizer()

# dlatk/textCleaner.py
mult_space, start_space, end_space = re.compile(r'\s\s+'), re.compile(r'^\s+'), re.compile(r'\s+$')
mult_dots, newlines = re.compile(r'\.\.\.\.\.+'), re.compile(r'\s*\n\s*')

def clean(s):
    s = newlines.sub(' <NEWLINE> ', s)
    s = mult_space.sub(' ', s)
    s = mult_dots.sub('....', s)
    s = end_space.sub('', s)
    s = start_space.sub('', s)
    return newlines.sub(' <NEWLINE> ', s)

def remove_non_utf8(s):
    return ' '.join('<NON-UTF8>' if len(w.encode('utf-8', 'ignore').decode('utf-8', 'ignore')) < len(w) else w for w in s.split())

def tokenize(text):
    return [remove_non_utf8(token).lower() for token in tokenizer.tokenize(clean(text))]

def score(messages, model):
    ngrams = {}
    for n in model['ngrams']:
        counts, total = {}, 0
        for tokens in messages:
            for i in range(len(tokens) - n + 1):
                gram = ' '.join(tokens[i:i + n])
                counts[gram] = counts.get(gram, 0) + 1
                total += 1
        ngrams[n] = {gram: 1.0 if model['encoding'] == 'binary' else count / total for gram, count in counts.items()}
    values = {}
    for category, weights in model['categories'].items():
        hits = [(gram, value) for grams in ngrams.values() for gram, value in grams.items() if gram in weights]
        values[category] = model['intercepts'].get(category, 0) + sum(weights[g] * v for g, v in hits) if hits else None
    return values

texts = [
    'I love spending time with my family :)',
    "ugh so tired of this... can't wait for the weekend!!!",
    'Going to the beach tomorrow with the girls :D\nso excited!!',
    "Yesterday was the worst day ever. My phone broke :'(",
    'check this out http://www.youtube.com/watch?v=abc123 lol',
    'is listening to The Sad Cafe by The Eagles! >:( -_- ^_^',
    'happy birthday to my beautiful daughter <3 <3 love you so much',
    'i will finish my homework tonight . . . maybe .. or not',
    'Thank you everyone for the birthday wishes!!! I had a great day :)',
    'feeling sick of everything... depressed and bored. ugh',
    'HTML &amp; entities &aacute;cute &#9829; <em class="x">pain</em> &amp; more',
    'call me (800) 123-4567 or +1 555.123.4567 re: 9/11, 24/7 & 1,000,000 :-) D: XD',
    '@friend #blessed #love_it [web_address_removed] google.com/x t.co/abc \\x41 tabs\there',
    'don’t “quote” me…… ..... . . . .. .',
    'Mañana voy a la playa con mi familia, ¡qué día! te quiero mucho\n\njajaja',
    'odio el lunes :( estoy triste y aburrido https://t.co/xyz',
]
rng = random.Random(2014)
atoms = list(":;=8<>()[]{}|/\\-o*'^_.,~#@!?\"%&+$0123456789DPxXO3") + [
    ' ', '  ', '\n', '\r\n', '\t', ' ', ' ', '\x1c', 'a', 'Z', 'é', 'é', 'ñ', 'Σ', 'İ', 'ß',
    '٣', '😀', '❤️', '’', '“', '…', 'http://', 'www.', 'google', '.com', '.co', 't.co/x', '&amp;',
    '&lt;', '&aacute;', '&bogus;', '&#39;', '&#9999999;', '\\x41', '<br />', "<em class='g'>", '</3', '<3',
    '(800) 123-4567', '#tag', '@user', '[web_address_removed]', '/w?a=b;c=d', "can't", 'well-known',
    '1,000', '9/11', '-3.5+', '.....', '. . .', '..', '<NEWLINE>', '\x08', 'the', ':-)', '>:(', '^_^', 'o.O',
]
fuzz = [''.join(rng.choice(atoms) for _ in range(rng.randint(0, 40))) for _ in range(300)]
models = json.loads((root / 'data/models.json').read_text())
groups = [[t] for t in texts] + [texts[:4], texts[14:]]
fixture = {
    'description': __doc__.strip(),
    'tokenizer': [[text, tokenize(text)] for text in texts + fuzz],
    'scores': [
        {'texts': group, 'expected': {name: score([tokenize(t) for t in group], model) for name, model in models.items()}}
        for group in groups
    ],
}
target = root / 'test/dlatk-fixture.json'
target.write_text(json.dumps(fixture, indent=1) + '\n')
print('Wrote', target)
