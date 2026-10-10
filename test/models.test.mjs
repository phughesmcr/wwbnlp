import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { analyse, models, tokenize } from "../dist/src/index.js";
const fixture = JSON.parse(
  readFileSync(new URL("./dlatk-fixture.json", import.meta.url)),
);
test("tokenizer reproduces the pinned Happier Fun Tokenizer and DLATK cleaning", () => {
  for (const [text, tokens] of fixture.tokenizer) {
    assert.deepEqual(tokenize(text), tokens, JSON.stringify(text));
  }
});
test("all nine models reproduce DLATK weighted-lexicon scores per message and per group", () => {
  for (const { texts, expected } of fixture.scores) {
    assert.deepEqual(Object.keys(models).sort(), Object.keys(expected).sort());
    const messages = texts.map(tokenize);
    for (const [id, values] of Object.entries(expected)) {
      const result = analyse(messages, id);
      for (const [category, value] of Object.entries(values)) {
        const label = `${id}.${category} ${JSON.stringify(texts)}`;
        if (value === null) assert.equal(result.values[category], null, label);
        else {assert.ok(
            Math.abs(result.values[category] - value) < 1e-10,
            `${label}: ${result.values[category]} vs ${value}`,
          );}
      }
    }
  }
});
test("canonical Spanish accents, model intercepts, and structural features are retained", () => {
  assert.ok(Object.hasOwn(models.permaEs.categories.POS_P, "día de"));
  assert.equal(models.age.intercepts.AGE, 23.2188604687);
  assert.equal(models.affect.intercepts.AFFECT, 5.03710472069);
  assert.ok(
    analyse("día de familia trabajo amor :)", "permaEs").info
      .uniqueMatchedTerms > 0,
  );
  assert.ok(analyse("happy", "perma").warnings.length > 0);
  assert.equal(analyse("", "age").values.AGE, null);
  assert.throws(() => analyse("a", "__proto__"), RangeError);
  assert.throws(() => analyse("a", "unknown"), RangeError);
});
test("npm entry point can be used from both ESM and supported CommonJS", () => {
  const require = createRequire(import.meta.url);
  const cjs = require("wwbnlp");
  assert.equal(
    cjs.analyse("happy", "affect").values.AFFECT,
    analyse("happy", "affect").values.AFFECT,
  );
});
