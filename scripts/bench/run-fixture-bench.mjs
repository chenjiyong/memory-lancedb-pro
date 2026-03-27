#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const fixturePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "test", "fixtures", "benchmark", "runtime-fixtures.json");
const runnerPath = path.join(repoRoot, "scripts", "benchmark-fixture-runner.mjs");

const child = spawn("node", [runnerPath, fixturePath], {
  cwd: repoRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

