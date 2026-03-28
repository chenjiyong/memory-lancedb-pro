# Benchmark Entrypoints

## Purpose

This directory provides stable command entrypoints for local benchmark smoke runs and future external benchmark adapters.

## Current entrypoints

- `run-fixture-bench.mjs`
  - delegates to `scripts/benchmark-fixture-runner.mjs`
  - uses `test/fixtures/benchmark/runtime-fixtures.json` by default
- `run-adapter-bench.mjs`
  - lists supported external adapters
  - validates adapter config readiness
  - can execute a configured external adapter command and report JSON output if present

## Planned expansion

- external dataset adapters for:
  - `MemoryAgentBench`
  - `LongMemEval`
  - `LoCoMo`
  - `Mem2ActBench`
  - `MemBench`

## Local usage

```bash
node scripts/bench/run-fixture-bench.mjs
node scripts/bench/run-fixture-bench.mjs test/fixtures/benchmark/runtime-fixtures.json
node scripts/bench/run-adapter-bench.mjs --list
node scripts/bench/run-adapter-bench.mjs --check /absolute/path/to/adapter-config.json
node scripts/bench/run-adapter-bench.mjs --run /absolute/path/to/adapter-config.json
```
