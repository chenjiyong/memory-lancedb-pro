import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "bench", "run-adapter-bench.mjs");

test("benchmark adapter runner lists supported adapters", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--list"], {
    cwd: repoRoot,
  });

  const parsed = JSON.parse(stdout);
  assert.deepEqual(
    parsed.adapters.map((entry) => entry.name),
    ["MemoryAgentBench", "LongMemEval", "LoCoMo", "Mem2ActBench", "MemBench"],
  );
});

test("benchmark adapter runner reports missing readiness requirements", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bench-adapter-missing-"));
  const configPath = path.join(tempRoot, "adapter-config.json");

  await writeFile(
    configPath,
    JSON.stringify(
      {
        adapter: "MemoryAgentBench",
        datasetRoot: path.join(tempRoot, "dataset"),
        outputPath: path.join(tempRoot, "reports", "result.json"),
      },
      null,
      2,
    ),
  );

  const { stdout } = await execFileAsync("node", [scriptPath, "--check", configPath], {
    cwd: repoRoot,
  });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ready, false);
  assert.match(parsed.issues.join("\n"), /datasetRoot does not exist/i);
  assert.match(parsed.issues.join("\n"), /command is required/i);
});

test("benchmark adapter runner executes configured adapter command", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bench-adapter-run-"));
  const datasetRoot = path.join(tempRoot, "dataset");
  const outputPath = path.join(tempRoot, "reports", "result.json");
  const adapterScript = path.join(tempRoot, "mock-adapter.mjs");
  const configPath = path.join(tempRoot, "adapter-config.json");

  await mkdir(datasetRoot, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(path.join(datasetRoot, "sample.json"), JSON.stringify({ ok: true }));
  await writeFile(
    adapterScript,
    [
      "import { mkdir, writeFile } from 'node:fs/promises';",
      "import path from 'node:path';",
      "const outputPath = process.argv[process.argv.indexOf('--output') + 1];",
      "const datasetRoot = process.argv[process.argv.indexOf('--dataset') + 1];",
      "await mkdir(path.dirname(outputPath), { recursive: true });",
      "await writeFile(outputPath, JSON.stringify({ adapter: 'MemoryAgentBench', datasetRoot, score: 0.91 }, null, 2));",
      "console.error('mock adapter executed');",
    ].join("\n"),
  );
  await writeFile(
    configPath,
    JSON.stringify(
      {
        adapter: "MemoryAgentBench",
        datasetRoot,
        outputPath,
        command: ["node", adapterScript, "--dataset", "{datasetRoot}", "--output", "{outputPath}"],
      },
      null,
      2,
    ),
  );

  const { stdout, stderr } = await execFileAsync("node", [scriptPath, "--run", configPath], {
    cwd: repoRoot,
  });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.exitCode, 0);
  assert.equal(parsed.outputExists, true);
  assert.equal(parsed.result?.score, 0.91);
  assert.match(stderr, /mock adapter executed/i);
});
