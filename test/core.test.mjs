import assert from "node:assert/strict";
import { test } from "node:test";
import { createLexicon, score, tokenize } from "../dist/src/core.js";
const lexicon = createLexicon({
  id: "example",
  ngrams: [1],
  categories: { value: { a: 3, b: 87, c: -15 } },
  intercepts: { value: 23.2189 },
});
test("WWBP worked examples include unmatched tokens in the denominator", () => {
  const first = "a a b b b b b b b b b b c c c e e e e e e f f f f";
  const second = "a a a a a b b b c c c c c c c c d d d d f f f f f f f f f f";
  assert.equal(score(first, lexicon, { decimals: 10 }).values.value, 56.4589);
  assert.equal(score(second, lexicon, { decimals: 10 }).values.value, 28.4189);
  const result = score(first, lexicon);
  assert.equal(result.info.tokenCount, 25);
  assert.equal(result.info.matchedFeatureCount, 15);
  assert.ok(
    Math.abs(
      result.matches.value.find((m) => m.term === "b").contribution - 34.8,
    ) < 1e-12,
  );
});
test("encoding, intercepts and weight filters are explicit", () => {
  assert.equal(
    score("a a b c ignored", lexicon, {
      encoding: "binary",
      includeIntercept: false,
    }).values.value,
    75,
  );
  assert.equal(
    score("a a b c ignored", lexicon, { encoding: "percent" }).values.value,
    0.8,
  );
  assert.equal(
    score("a a b c ignored", lexicon, { minWeight: 0, decimals: 10 }).values
      .value,
    41.8189,
  );
});
test("each ngram size is normalized by its own ngram count, as DLATK group_norm", () => {
  const model = createLexicon({
    id: "phrase",
    categories: { value: { "really good": 2, good: 1 } },
  });
  const result = score(["really", "good", "really", "good"], model, {
    ngrams: [1, 2, 2],
  });
  // 2 of 3 bigrams and 2 of 4 unigrams: 2 * 2/3 + 1 * 2/4
  assert.ok(Math.abs(result.values.value - (4 / 3 + 0.5)) < 1e-15);
  assert.equal(result.info.featureCount, 7);
  const phrase = result.matches.value.find((m) => m.term === "really good");
  assert.equal(phrase.count, 2);
  assert.equal(phrase.n, 2);
  assert.equal(score("really", model).status, "no-matches");
});
test("messages are pooled for relative frequency but ngrams never span them", () => {
  const model = createLexicon({
    id: "messages",
    categories: { value: { "good day": 4, good: 1 } },
  });
  const result = score([["good"], ["day", "good", "day"]], model);
  assert.equal(result.info.messageCount, 2);
  assert.equal(result.info.tokenCount, 4);
  assert.equal(result.info.featureCount, 4 + 2 + 1);
  // "good day" once in 2 bigrams; "good" twice in 4 unigrams
  assert.equal(result.values.value, 4 * 0.5 + 1 * 0.5);
  assert.equal(
    score([["good", "day"]], model).values.value,
    score(["good", "day"], model).values.value,
  );
  assert.throws(() => score([["good"], "day"], model), TypeError);
  assert.equal(score([[], []], model).status, "empty");
});
test("empty and unknown text never create intercept-only predictions", () => {
  for (const input of ["", "  ", []]) {
    assert.equal(score(input, lexicon).status, "empty");
    assert.equal(score(input, lexicon).values.value, null);
  }
  assert.equal(score("unmatched", lexicon).status, "no-matches");
  assert.equal(score("unmatched", lexicon).values.value, null);
});
test("tokenization follows the Happier Fun Tokenizer, quirks included", () => {
  assert.deepEqual(tokenize("DÍA de ❤️ familia! I’m happy :) <3..."), [
    "día",
    "de",
    "❤",
    "\uFE0F",
    "familia",
    "!",
    "i",
    "’",
    "m",
    "happy",
    ":)",
    "<3",
    "...",
  ]);
  assert.deepEqual(
    tokenize("Bored . . . so bored\n\nXD >:( -_- http://t.co/abc"),
    [
      "bored",
      ". . .",
      "so",
      "bored",
      "<newline>",
      "xd",
      ">:(",
      "-_-",
      "http://t.co",
      "/",
      "abc",
    ],
  );
  assert.deepEqual(tokenize("mañana 12.5 @name #tag ! !"), [
    "mañana",
    "12.5",
    "@name",
    "#tag",
    "!",
    "!",
  ]);
  // DLATK replaces invalid UTF-16 (here, a lone surrogate) per token.
  assert.deepEqual(tokenize("ok wo\ud83drd :)"), [
    "ok",
    "wo",
    "<non-utf8>",
    "rd",
    ":)",
  ]);
  // HFT decodes &amp; only when another named entity is present.
  assert.deepEqual(tokenize("Tom &amp; Jerry"), [
    "tom",
    "&",
    "amp",
    ";",
    "jerry",
  ]);
  assert.deepEqual(tokenize("Tom &amp; Jerry &hearts;"), [
    "tom",
    "and",
    "jerry",
    "♥",
  ]);
});
test("custom data is immutable and prototype keys cannot be interpreted as weights", () => {
  const terms = { a: 2 };
  const model = createLexicon({ id: "safe", categories: { value: terms } });
  terms.a = 999;
  assert.equal(score("a", model).values.value, 2);
  assert.equal(
    score(["constructor", "__proto__", "toString"], model).status,
    "no-matches",
  );
  assert.throws(() => {
    model.categories.value.a = 8;
  }, TypeError);
  const explicit = createLexicon({
    id: "explicit",
    categories: JSON.parse('{"__proto__":{"constructor":3}}'),
  });
  assert.equal(score(["constructor"], explicit).values.__proto__, 3);
});
test("structural features contribute exactly once and missing values are reported", () => {
  const model = createLexicon({
    id: "features",
    categories: { value: { a: 2 } },
    features: { value: { length: 0.5 } },
    intercepts: { value: 1 },
  });
  assert.equal(score("a", model, { features: { length: 4 } }).values.value, 5);
  assert.equal(score("a", model).warnings.length, 1);
  assert.equal(
    score("", model, { features: { length: 4 } }).values.value,
    null,
  );
  assert.equal(
    score("a", model, { encoding: "percent", features: { length: 4 } }).values
      .value,
    1,
  );
});
test("invalid inputs and obsolete options fail clearly without mutating caller options", () => {
  for (const input of [null, 12, {}, [""], ["a", 2]]) {
    assert.throws(() => score(input, lexicon), TypeError);
  }
  for (
    const options of [
      { ngrams: [0] },
      { ngrams: [-1] },
      { ngrams: [1.5] },
      { encoding: "typo" },
      { decimals: 101 },
      { minWeight: NaN },
      { minWeight: 5, maxWeight: 2 },
      { logs: 0 },
      { features: { unknown: 1 } },
    ]
  ) assert.throws(() => score("a", lexicon, options));
  assert.throws(
    () => createLexicon({ id: "bad", categories: { value: { a: Infinity } } }),
    TypeError,
  );
  assert.throws(() =>
    createLexicon({
      id: "bad",
      categories: { value: {} },
      intercepts: { typo: 1 },
    })
  );
  assert.throws(() => score("a", lexicon, { features: { length: NaN } }));
  const options = Object.freeze({
    ngrams: Object.freeze([1]),
    includeIntercept: false,
  });
  assert.equal(score("a", lexicon, options).values.value, 3);
});
test("percent coverage stays bounded when words and overlapping phrases all match", () => {
  const model = createLexicon({
    id: "coverage",
    categories: { value: { good: 5, "good good": 9, "good good good": 11 } },
  });
  const result = score("good good good", model, { encoding: "percent" });
  assert.equal(result.info.featureCount, 6);
  assert.equal(result.values.value, 1);
});
