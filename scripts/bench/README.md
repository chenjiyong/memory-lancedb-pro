# Benchmark Entrypoints

## Purpose

This directory provides stable command entrypoints for local benchmark smoke runs and future external benchmark adapters.

## Current entrypoints

- `run-fixture-bench.mjs`
  - delegates to `scripts/benchmark-fixture-runner.mjs`
  - uses `test/fixtures/benchmark/runtime-fixtures.json` by default

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
```

