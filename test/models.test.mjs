import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { analyse, createLexicon, models, tokenize } from "../dist/src/index.js";
const fixture = JSON.parse(
  readFileSync(new URL("./dlatk-fixture.json", import.meta.url)),
);
test("tokenizer reproduces the pinned Happier Fun Tokenizer and DLATK cleaning", () => {
  for (const [text, tokens] of fixture.tokenizer) {
    assert.deepEqual(tokenize(text), tokens, JSON.stringify(text));
  }
});
test("all nine models reproduce the reference scores per message and per group", () => {
  for (const { texts, expected } of fixture.scores) {
    assert.deepEqual(
      [...Object.keys(models), "optimism"].sort(),
      Object.keys(expected).sort(),
    );
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
  assert.ok(
    Object.hasOwn(models.permaEs.categories.POS_P, "muchísimas gracias"),
  );
  // DLATK's dd_sperma_v2: MySQL escapes are decoded and its intercepts retained.
  assert.ok(Object.hasOwn(models.permaEs.categories.NEG_E, '" qué'));
  assert.equal(models.permaEs.intercepts.POS_P, 3.37892421488);
  assert.equal(models.age.intercepts.AGE, 23.2188604687);
  assert.equal(models.affect.intercepts.AFFECT, 5.03710472069);
  assert.ok(
    analyse("muchísimas gracias mi niña :)", "permaEs").info
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
  for (const id of ["affect", "perma", "permaEs"]) {
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
  // Optimism: affect valence of the future-oriented messages only.
  const mixed = ["I will see you tomorrow :)", "Yesterday was awful", "ok"];
  const opt = analyse(mixed.map(tokenize), "optimism");
  const firstOnly = analyse([tokenize(mixed[0])], "affect").values.AFFECT;
  assert.equal(opt.values.OPTIMISM, firstOnly);
  assert.deepEqual(opt.messageValues.map((v) => v.OPTIMISM), [
    firstOnly,
    null,
    null,
  ]);
  assert.equal(opt.info.messageCount, 3);
  assert.equal(analyse("Yesterday was awful", "optimism").status, "no-matches");
  assert.equal(analyse("", "optimism").status, "empty");
  assert.throws(
    () => analyse("x", "optimism", { aggregation: "pool" }),
    RangeError,
  );
  // Invalid options fail whether or not any message is future-oriented.
  for (const options of [null, 12, [], "x"]) {
    for (const text of [mixed[0], mixed[1]]) {
      assert.throws(() => analyse(text, "optimism", options), TypeError);
    }
  }
});
test("Dark Triad warns below the authors' 500-token minimum", () => {
  assert.equal(models.darkTriad.minTokens, 500);
  assert.match(analyse("hot", "darkTriad").warnings[0], /at least 500 tokens/);
  const user = "Going to the gym then dinner with friends tonight . ".repeat(
    50,
  );
  assert.deepEqual(analyse(user, "darkTriad").warnings, []);
  assert.deepEqual(analyse("", "darkTriad").warnings, []);
  assert.throws(
    () => createLexicon({ id: "x", categories: { A: {} }, minTokens: 0 }),
    RangeError,
  );
});
test("documented differences from DLATK cannot change bundled scores", () => {
  // DLATK reads a trailing `*` as a prefix wildcard; the trained `f *` and `*`
  // features are literal HFT ngrams, so `f you` must not match `f *`.
  const terms = (text) =>
    analyse(text, "affect").matches.AFFECT.map((m) => m.term).sort();
  assert.deepEqual(terms("f you"), ["f", "you"]);
  assert.deepEqual(terms("f * you"), ["*", "f", "f *", "you"]);
  // DLATK's VARCHAR columns truncate 1-3grams to 36, 70 and 102 characters.
  // No bundled term reaches those lengths, so truncation cannot match one.
  const limits = [36, 70, 102];
  for (const [id, model] of Object.entries(models)) {
    for (const vocabulary of Object.values(model.categories)) {
      for (const term of Object.keys(vocabulary)) {
        const limit = limits[tokenize(term).length - 1];
        assert.ok(term.length < limit, `${id}: ${term}`);
      }
    }
  }
});
test("npm entry point can be used from both ESM and supported CommonJS", () => {
  const require = createRequire(import.meta.url);
  const cjs = require("wwbnlp");
  assert.equal(
    cjs.analyse("happy", "affect").values.AFFECT,
    analyse("happy", "affect").values.AFFECT,
  );
});
