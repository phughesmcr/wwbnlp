"""Regenerate test/dlatk-fixture.json from the original Happier Fun Tokenizer and DLATK's
ngram and weighted-lexicon arithmetic. Development only: unlike import-data.py, this
executes the pinned, checksum-verified upstream tokenizer (see data/provenance.json).

DLATK reference (featureExtractor.addNGramTable and addLexiconFeat): each message is
cleaned (newlines -> <NEWLINE>, shrinkSpace), HFT-tokenized and lowercased; n-grams
never span messages; group_norm = count / (all n-grams of that size in the group); a
weighted lexicon adds intercept + sum(weight * group_norm). Binary uses presence.

Groups follow each paper: user-level models pool a user's messages into one DLATK
group. Message-level models score each nonempty message; a message without matches
predicts its intercepts. A user's PERMA or affect score is the mean of their message
predictions (Schwartz et al. 2016, section 4.3); temporal orientation is the proportion
of their messages classified as each class (Schwartz et al. 2015; Park et al. 2016).
Input without any match in any category is unknown (None).

Optimism follows WWBP's lexica guidance: "filter messages to those future-oriented using
the future orientation lexicon, then apply the affect lexicon". A message is
future-oriented when FUTURE is its highest temporal score; OPTIMISM is the mean
valence of those messages.
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
entry = next(e for e in manifest['sources'] if e.get('path') == 'dlatk/lib/happierfuntokenizing.py')
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

def predict(messages, model):
    """One DLATK group's linear prediction, or None if no category has a match."""
    ngrams = {}
    for n in model['ngrams']:
        counts, total = {}, 0
        for tokens in messages:
            for i in range(len(tokens) - n + 1):
                gram = ' '.join(tokens[i:i + n])
                counts[gram] = counts.get(gram, 0) + 1
                total += 1
        ngrams[n] = {gram: 1.0 if model['encoding'] == 'binary' else count / total for gram, count in counts.items()}
    matched, values = False, {}
    for category, weights in model['categories'].items():
        hits = [(gram, value) for grams in ngrams.values() for gram, value in grams.items() if gram in weights]
        matched = matched or bool(hits)
        values[category] = model['intercepts'].get(category, 0) + sum(weights[g] * v for g, v in hits)
    return values if matched else None

def score(messages, model):
    categories = list(model['categories'])
    messages = [m for m in messages if m]  # DLATK skips empty messages
    if model['aggregation'] == 'pool':
        values = predict(messages, model) if messages else None
        return values or dict.fromkeys(categories)
    predictions = [predict([m], model) for m in messages]
    if not any(predictions):
        return dict.fromkeys(categories)
    predictions = [p or {c: model['intercepts'].get(c, 0) for c in categories} for p in predictions]
    if model['aggregation'] == 'mean':
        return {c: sum(p[c] for p in predictions) / len(predictions) for c in categories}
    shares = dict.fromkeys(categories, 0.0)
    for p in predictions:
        winners = [c for c in categories if p[c] == max(p.values())]
        for c in winners:
            shares[c] += 1 / len(winners) / len(predictions)
    return shares

def optimism(messages, models):
    temporal = models['temporal']
    future = []
    for m in messages:
        p = predict([m], temporal) if m else None
        if p and p['FUTURE'] == max(p.values()):
            future.append(m)
    return {'OPTIMISM': score(future, models['affect'])['AFFECT']}

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
    # re.IGNORECASE widens HFT's literal letters only: \w excludes U+0345 even though
    # it case-folds to a letter, while i also matches İ and ı, k K and s ſ.
    'so happy\u0345sad today',
    'see x.İnfo y.ınfo z.Kr w.uſ HTTPſ://a.CoM',
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
# Case folding, URLs, tags, hashtags and entities, which the port matches differently.
rng = random.Random(2026)
atoms = list("<>=/#.-'_ \n:;()[]@?&+019aZoOdD") + [
    '\u0345', 'İ', 'ı', 'K', 'ſ', 'Σ', '𝐀', '😀', 'http://', 'HTTPS://', '.com', '.CoM', '.İnfo', '.ınfo',
    '.ſg', '.Kr', '.io', 'www', '<a href=x>', '<br />', '< />', '<b', 'b>', 'a=b', '/x?a=b;c=d', '#tag', '##',
    '#a-b', "#a'", '&amp;', '&lt;', '&alpha;', '&#38;', '&#35;', '&#59;', '&#49;', '&#1633;', '8oD', 'o.O',
]
fuzz += [''.join(rng.choice(atoms) for _ in range(rng.randint(0, 40))) for _ in range(300)]
models = json.loads((root / 'data/models.json').read_text())
groups = [[t] for t in texts] + [
    ['haha'], texts[:4], texts[14:16], ['haha', texts[2], '', texts[3]],
    ['I will see you tomorrow :)', 'Yesterday was awful', "can't wait for the weekend!!", 'ok'],
]
fixture = {
    'description': __doc__.strip(),
    'tokenizer': [[text, tokenize(text)] for text in texts + fuzz],
    'scores': [
        {'texts': group, 'expected': {
            **{name: score([tokenize(t) for t in group], model) for name, model in models.items()},
            'optimism': optimism([tokenize(t) for t in group], models),
        }}
        for group in groups
    ],
}
target = root / 'test/dlatk-fixture.json'
target.write_text(json.dumps(fixture, indent=1) + '\n')
print('Wrote', target)
