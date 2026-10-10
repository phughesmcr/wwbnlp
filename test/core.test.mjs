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
  // Sparse arrays fail too: a hole is neither a token nor an ngram size.
  for (const input of [null, 12, {}, [""], ["a", 2], ["a", ,], [["a"], ,]]) {
    assert.throws(() => score(input, lexicon), TypeError);
  }
  assert.throws(
    () => score("a", lexicon, { ngrams: new Array(1) }),
    RangeError,
  );
  assert.throws(
    () => createLexicon({ id: "x", categories: { a: {} }, ngrams: [1, , 2] }),
    RangeError,
  );
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
test("categories share evidence: once any category matches, every category is scored", () => {
  const model = createLexicon({
    id: "shared",
    categories: { yes: { a: 1 }, no: { b: 1 } },
    intercepts: { yes: 0.5, no: 2 },
  });
  assert.deepEqual({ ...score("a", model).values }, { yes: 1.5, no: 2 });
  assert.deepEqual({ ...score("c", model).values }, { yes: null, no: null });
});
test("message-level aggregation averages messages or shares their argmax classes", () => {
  const model = createLexicon({
    id: "levels",
    categories: { up: { good: 2 }, down: { bad: 3 } },
    intercepts: { up: 1, down: 0 },
    encoding: "binary",
    aggregation: "mean",
  });
  const messages = [["good", "good"], ["bad"], [], ["meh"]];
  const mean = score(messages, model);
  // Three nonempty messages; "meh" predicts the intercepts (1, 0).
  assert.ok(Math.abs(mean.values.up - 5 / 3) < 1e-12);
  assert.ok(Math.abs(mean.values.down - 1) < 1e-12);
  assert.deepEqual(mean.messageValues.map((v) => v.up), [3, 1, null, 1]);
  const good = mean.matches.up.find((m) => m.term === "good");
  assert.equal(good.count, 2);
  assert.ok(Math.abs(good.contribution - 2 / 3) < 1e-12);
  const shares = score(messages, model, { aggregation: "argmax" });
  assert.ok(Math.abs(shares.values.up - 2 / 3) < 1e-12);
  assert.ok(Math.abs(shares.values.down - 1 / 3) < 1e-12);
  const tie = score([["good"], ["meh", "bad", "x"]], model, {
    aggregation: "argmax",
    includeIntercept: false,
  });
  assert.deepEqual({ ...tie.values }, { up: 0.5, down: 0.5 });
  assert.equal(score([["meh"], []], model).status, "no-matches");
  assert.equal(score([["meh"], []], model).messageValues[0].up, null);
  const pooled = score(messages, model, { aggregation: "pool" });
  assert.equal(pooled.values.up, 3);
  assert.deepEqual(pooled.messageValues, []);
  assert.throws(() => score("a", model, { aggregation: "median" }), RangeError);
  assert.throws(
    () => createLexicon({ id: "x", categories: { a: {} }, aggregation: "x" }),
    RangeError,
  );
});
test("numeric HTML entities accept any Unicode decimal digits, as Python int()", () => {
  assert.deepEqual(tokenize("&#٦٥;&#𝟔𝟔; ok"), ["ab", "ok"]);
  assert.deepEqual(tokenize("&#9999999; x"), ["&", "#9999999", ";", "x"]);
});
test("tokenizing pathological long inputs stays linear", () => {
  // Each took seconds to minutes when failed matches rescanned the rest of the
  // text; the reference fixture checks the tokens themselves.
  const inputs = [
    " ".repeat(200_000) + "x",
    "a.".repeat(100_000),
    "a.".repeat(100_000) + "com",
    "!".repeat(200_000),
    "< ".repeat(100_000),
    "<a".repeat(100_000) + ">",
    "#".repeat(200_000),
    Array.from({ length: 20_000 }, (_, i) => `&x${i};`).join(""),
  ];
  const start = performance.now();
  for (const text of inputs) tokenize(text);
  assert.ok(performance.now() - start < 2000);
  assert.deepEqual(tokenize("a.".repeat(3) + "com"), ["a.a.a.com"]);
  assert.deepEqual(tokenize("x\n \t\n y"), ["x", "<newline>", "y"]);
});
