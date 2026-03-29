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
- `check-longmemeval.mjs`
  - validates one LongMemEval config file through the shared adapter runner
- `run-longmemeval.mjs`
  - runs the offline LongMemEval harness, then calls the official evaluator or the repository-local OpenAI-compatible evaluator wrapper

## Planned expansion

- external dataset adapters for:
  - `MemoryAgentBench`
  - `LoCoMo`
  - `Mem2ActBench`
  - `MemBench`

## Current status

As of `2026-03-29`:

- local fixture smoke benchmark is implemented
- adapter wrapper entrypoints are implemented
- `LongMemEval` is the only benchmark with a repo-local adapter implementation
- `MemoryAgentBench`, `LoCoMo`, `Mem2ActBench`, and `MemBench` remain adapter-registry entries without repo-local adapters

Tracked benchmark skill source:

- `skills/memory-benchmark-suite/SKILL.md`
- `skills/memory-benchmark-suite/benchmark-runbook.md`

## LongMemEval

The first real external benchmark path now targets `LongMemEval`:

- use an external local clone of the official repository
- keep benchmark data outside this repository
- run the repo-local offline harness first
- call the official `src/evaluation/evaluate_qa.py` evaluator afterward, or use the optional OpenAI-compatible evaluator override for providers such as OpenRouter

Example config:

```bash
node scripts/bench/check-longmemeval.mjs scripts/bench/configs/longmemeval.example.json
node scripts/bench/run-longmemeval.mjs /absolute/path/to/longmemeval.json
```

## Local usage

```bash
node scripts/bench/run-fixture-bench.mjs
node scripts/bench/run-fixture-bench.mjs test/fixtures/benchmark/runtime-fixtures.json
node scripts/bench/run-adapter-bench.mjs --list
node scripts/bench/run-adapter-bench.mjs --check /absolute/path/to/adapter-config.json
node scripts/bench/run-adapter-bench.mjs --run /absolute/path/to/adapter-config.json
npm run bench:longmemeval:check -- /absolute/path/to/longmemeval.json
npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json
```
