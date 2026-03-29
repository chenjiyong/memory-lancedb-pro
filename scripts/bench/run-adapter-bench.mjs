#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBenchmarkAdapter, listBenchmarkAdapters } from "./adapter-registry.mjs";
import {
  buildLongMemEvalReadinessSummary,
  runLongMemEvalAdapter,
} from "./longmemeval/adapter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function printUsage() {
  console.error("Usage: node scripts/bench/run-adapter-bench.mjs --list | --check <config.json> | --run <config.json>");
}

function resolvePath(value, baseDir) {
  if (!value) {
    return value;
  }
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig(configPath) {
  const resolvedConfigPath = path.resolve(configPath);
  const configDir = path.dirname(resolvedConfigPath);
  const raw = await readFile(resolvedConfigPath, "utf8");
  const parsed = JSON.parse(raw);
  const resolved = {
    ...parsed,
    configPath: resolvedConfigPath,
    configDir,
    cwd: resolvePath(parsed.cwd || repoRoot, configDir),
    repoRoot: resolvePath(parsed.repoRoot, configDir),
    datasetRoot: resolvePath(parsed.datasetRoot, configDir),
    outputPath: resolvePath(parsed.outputPath, configDir),
    artifactsDir: resolvePath(parsed.artifactsDir, configDir),
    reader: parsed.reader && typeof parsed.reader === "object"
      ? {
          ...parsed.reader,
          oauthPath: resolvePath(parsed.reader.oauthPath, configDir),
        }
      : parsed.reader,
  };
  return resolved;
}

function interpolateToken(token, config) {
  return String(token)
    .replaceAll("{adapter}", config.adapter || "")
    .replaceAll("{datasetRoot}", config.datasetRoot || "")
    .replaceAll("{outputPath}", config.outputPath || "")
    .replaceAll("{cwd}", config.cwd || "");
}

function buildCommand(config) {
  if (!Array.isArray(config.command) || config.command.length === 0) {
    return null;
  }

  const parts = config.command.map((token) => interpolateToken(token, config));
  const executable = parts[0];
  const args = parts.slice(1);
  return { executable, args };
}

async function buildReadinessSummary(configPath) {
  const config = await loadConfig(configPath);
  const adapter = getBenchmarkAdapter(config.adapter);
  if (config.adapter === "LongMemEval") {
    return buildLongMemEvalReadinessSummary(config);
  }
  const issues = [];

  if (!adapter) {
    issues.push(`Unsupported adapter: ${config.adapter}`);
  }
  if (!config.datasetRoot) {
    issues.push("datasetRoot is required");
  } else if (!(await pathExists(config.datasetRoot))) {
    issues.push(`datasetRoot does not exist: ${config.datasetRoot}`);
  }
  if (!config.outputPath) {
    issues.push("outputPath is required");
  } else {
    const outputDir = path.dirname(config.outputPath);
    if (!(await pathExists(outputDir))) {
      issues.push(`outputPath parent does not exist: ${outputDir}`);
    }
  }
  if (!Array.isArray(config.command) || config.command.length === 0) {
    issues.push("command is required and must be a non-empty array");
  }

  const builtCommand = buildCommand(config);
  if (builtCommand?.executable && (builtCommand.executable.includes("/") || builtCommand.executable.startsWith("."))) {
    const executablePath = resolvePath(builtCommand.executable, config.cwd || config.configDir);
    if (!(await pathExists(executablePath))) {
      issues.push(`command executable does not exist: ${executablePath}`);
    }
  }

  return {
    mode: "check",
    adapter: config.adapter,
    supported: Boolean(adapter),
    ready: issues.length === 0,
    issues,
    configPath: config.configPath,
    cwd: config.cwd,
    datasetRoot: config.datasetRoot,
    outputPath: config.outputPath,
    command: builtCommand ? [builtCommand.executable, ...builtCommand.args] : null,
  };
}

async function runAdapter(configPath) {
  const config = await loadConfig(configPath);
  if (config.adapter === "LongMemEval") {
    const summary = await runLongMemEvalAdapter(config);
    process.stdout.write(formatJson(summary));
    process.stdout.write("\n");
    if (summary.exitCode !== 0 || summary.signal) {
      process.exit(summary.exitCode ?? 1);
    }
    return;
  }

  const summary = await buildReadinessSummary(configPath);
  if (!summary.ready) {
    process.stdout.write(formatJson(summary));
    process.stdout.write("\n");
    process.exit(1);
  }

  const builtCommand = buildCommand(config);

  const child = spawn(builtCommand.executable, builtCommand.args, {
    cwd: config.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  const exit = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (exitCode, signal) => resolve({ exitCode, signal }));
  });

  const outputExists = config.outputPath ? await pathExists(config.outputPath) : false;
  let result = null;
  if (outputExists) {
    try {
      result = JSON.parse(await readFile(config.outputPath, "utf8"));
    } catch {
      result = null;
    }
  }

  const runSummary = {
    ...summary,
    mode: "run",
    exitCode: exit.exitCode,
    signal: exit.signal,
    outputExists,
    result,
  };

  process.stdout.write(formatJson(runSummary));
  process.stdout.write("\n");

  if (exit.exitCode !== 0 || exit.signal) {
    process.exit(exit.exitCode ?? 1);
  }
}

async function main() {
  const [mode, configPath] = process.argv.slice(2);

  if (mode === "--list") {
    process.stdout.write(formatJson({ adapters: listBenchmarkAdapters() }));
    process.stdout.write("\n");
    return;
  }

  if (!mode || !configPath) {
    printUsage();
    process.exit(1);
  }

  if (mode === "--check") {
    const summary = await buildReadinessSummary(configPath);
    process.stdout.write(formatJson(summary));
    process.stdout.write("\n");
    return;
  }

  if (mode === "--run") {
    await runAdapter(configPath);
    return;
  }

  printUsage();
  process.exit(1);
}

main().catch((error) => {
  console.error("benchmark adapter runner failed:", error);
  process.exit(1);
});
