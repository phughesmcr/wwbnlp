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
test("message-level research models follow their papers", () => {
  // Temporal: a message is classified by its highest one-vs-rest score,
  // intercepts included; groups report the share of messages in each class.
  const haha = analyse("haha", "temporal");
  assert.ok(haha.messageValues[0].FUTURE < haha.messageValues[0].PRESENT);
  assert.deepEqual({ ...haha.values }, { PRESENT: 1, FUTURE: 0, PAST: 0 });
  const posts = ["I will see you tomorrow", "Yesterday was great", "ok"];
  const user = analyse(posts.map(tokenize), "temporal");
  assert.equal(user.messageValues.length, 3);
  assert.ok(
    Math.abs(Object.values(user.values).reduce((a, b) => a + b) - 1) < 1e-12,
  );
  // Affect and PERMA: binary per-message indicators, averaged over messages.
  for (const id of ["affect", "perma", "permaEs", "optimism"]) {
    assert.equal(models[id].encoding, "binary", id);
    assert.equal(models[id].aggregation, "mean", id);
  }
  const affect = analyse(posts.map(tokenize), "affect");
  const mean = affect.messageValues.reduce((a, v) => a + v.AFFECT, 0) / 3;
  assert.ok(Math.abs(affect.values.AFFECT - mean) < 1e-12);
  for (const id of ["age", "gender", "bigFive", "darkTriad"]) {
    assert.equal(models[id].aggregation, "pool", id);
  }
  // Big Five quote terms restored from WWBP's rmatrix files.
  assert.equal(models.bigFive.categories.O['" -'], 0.122342);
  assert.equal(models.bigFive.categories.A["the lord ,"], 0.040261);
  // Optimism keeps only future-indicating terms and has no affect intercept.
  for (const term of Object.keys(models.optimism.categories.OPTIMISM)) {
    assert.ok(models.temporal.categories.FUTURE[term] > 0, term);
  }
  assert.equal(models.optimism.intercepts.OPTIMISM, 0);
});
test("npm entry point can be used from both ESM and supported CommonJS", () => {
  const require = createRequire(import.meta.url);
  const cjs = require("wwbnlp");
  assert.equal(
    cjs.analyse("happy", "affect").values.AFFECT,
    analyse("happy", "affect").values.AFFECT,
  );
});
