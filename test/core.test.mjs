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
test("contiguous ngrams include final window, duplicates are not double-counted", () => {
  const model = createLexicon({
    id: "phrase",
    categories: { value: { "really good": 2, good: 1 } },
  });
  const result = score(["really", "good", "really", "good"], model, {
    ngrams: [1, 2, 2],
  });
  assert.equal(result.values.value, 1.5);
  assert.equal(result.info.featureCount, 7);
  assert.equal(
    result.matches.value.find((m) => m.term === "really good").count,
    2,
  );
  assert.equal(score("really", model).status, "no-matches");
});
test("empty and unknown text never create intercept-only predictions", () => {
  for (const input of ["", "  ", []]) {
    assert.equal(score(input, lexicon).status, "empty");
    assert.equal(score(input, lexicon).values.value, null);
  }
  assert.equal(score("unmatched", lexicon).status, "no-matches");
  assert.equal(score("unmatched", lexicon).values.value, null);
});
test("Unicode, social punctuation and emoticons survive tokenization", () => {
  assert.deepEqual(tokenize("DÍA de ❤️ familia! I’m happy :) <3..."), [
    "día",
    "de",
    "❤️",
    "familia",
    "!",
    "i'm",
    "happy",
    ":)",
    "<3",
    "...",
  ]);
  assert.deepEqual(tokenize("mañana 12.5 @name #tag ! !"), [
    "mañana",
    "12.5",
    "@name",
    "#tag",
    "!",
    "!",
  ]);
  assert.deepEqual(tokenize("di\u0301a"), ["día"]);
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
