import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("benchmark fixture runner reports passing local fixtures", async () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const fixturePath = path.join(repoRoot, "test", "fixtures", "benchmark", "runtime-fixtures.json");
  const scriptPath = path.join(repoRoot, "scripts", "benchmark-fixture-runner.mjs");

  const { stdout } = await execFileAsync("node", [scriptPath, fixturePath], {
    cwd: repoRoot,
  });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.failed, 0);
  assert.equal(parsed.passed, parsed.total);
});
