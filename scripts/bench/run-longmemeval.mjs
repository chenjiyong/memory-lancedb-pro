#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = process.argv[2] || process.env.LONGMEMEVAL_CONFIG;

if (!configPath) {
  console.error("Usage: npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json");
  process.exit(1);
}

const child = spawn("node", [path.join(__dirname, "run-adapter-bench.mjs"), "--run", configPath], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
