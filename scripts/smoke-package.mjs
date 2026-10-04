import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "wwbnlp-package-"));
try {
  const [packed] = JSON.parse(
    execFileSync("npm", [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      directory,
    ], { encoding: "utf8" }),
  );
  execFileSync("npm", [
    "install",
    "--prefix",
    directory,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    join(directory, packed.filename),
  ], { stdio: "inherit" });
  writeFileSync(
    join(directory, "example.mts"),
    `import { analyse, type Analysis } from 'wwbnlp';
import { createLexicon, score } from 'wwbnlp/core';
const result: Analysis = analyse(['happy'], 'affect');
if (result.status !== 'ok') throw new Error('Packed model failed');
const lexicon = createLexicon({ id: 'example', categories: { value: { a: 2 } } });
if (score('a', lexicon).values.value !== 2) throw new Error('Packed core failed');
`,
  );
  execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc",
    "--ignoreConfig",
    join(directory, "example.mts"),
    "--module",
    "NodeNext",
    "--strict",
    "--outDir",
    join(directory, "compiled"),
  ], { stdio: "inherit" });
  execFileSync(process.execPath, [join(directory, "compiled/example.mjs")], {
    stdio: "inherit",
  });
  execFileSync(process.execPath, [
    "--input-type=commonjs",
    "-e",
    "if (require('wwbnlp').analyse('happy','affect').status !== 'ok') throw new Error('Packed CommonJS failed')",
  ], { cwd: directory, stdio: "inherit" });
  console.log(
    "Packed package installs, type-checks and runs in ESM and CommonJS.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
