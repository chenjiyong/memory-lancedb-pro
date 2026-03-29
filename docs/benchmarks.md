# Benchmarks

## Goal

Turn benchmark validation into an explicit release gate instead of an informal note.

## Local smoke benchmark

The repository currently ships a fixture-based smoke benchmark:

```bash
npm run bench:fixtures
```

It validates:

- scenario detection
- scenario-aware reranking
- expected top artifact kind selection

It does not claim to replace real benchmark datasets.

## External benchmark adapter plan

The intended adapter layer should support:

- `MemoryAgentBench`
- `LongMemEval`
- `LoCoMo`
- `Mem2ActBench`
- `MemBench`

The repository now ships an adapter wrapper entrypoint:

```bash
node scripts/bench/run-adapter-bench.mjs --list
node scripts/bench/run-adapter-bench.mjs --check /absolute/path/to/adapter-config.json
node scripts/bench/run-adapter-bench.mjs --run /absolute/path/to/adapter-config.json
```

Adapter config files should provide:

- `adapter`
- `repoRoot` for benchmarks that ship their own evaluator
- `datasetRoot`
- `datasetFile`
- `outputPath`
- `artifactsDir`
- `embedding`
- `reader`
- optional `evaluator` when the official evaluator must run through an OpenAI-compatible endpoint

Example:

```json
{
  "adapter": "LongMemEval",
  "repoRoot": "/absolute/path/to/LongMemEval",
  "datasetRoot": "/absolute/path/to/LongMemEval/data",
  "datasetFile": "longmemeval_s_cleaned.json",
  "artifactsDir": "/absolute/path/to/reports/longmemeval-artifacts",
  "outputPath": "/absolute/path/to/reports/longmemeval-summary.json",
  "embedding": {
    "provider": "openai-compatible",
    "apiKey": "${EMBEDDING_API_KEY}",
    "model": "text-embedding-3-small",
    "baseURL": "https://api.openai.com/v1"
  },
  "reader": {
    "mode": "llm",
    "auth": "api-key",
    "apiKey": "${OPENAI_API_KEY}",
    "model": "gpt-4o-mini",
    "baseURL": "https://api.openai.com/v1",
    "timeoutMs": 30000
  },
  "metricModel": "gpt-4o",
  "evaluator": {
    "mode": "openai-compatible",
    "apiKey": "${OPENAI_API_KEY}",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "timeoutMs": 30000
  }
}
```

## LongMemEval

The first real benchmark integration in this repository targets the official [LongMemEval](https://github.com/xiaowu0162/LongMemEval) repository.

Supported in this first pass:

- `longmemeval_s_cleaned.json`
- `longmemeval_oracle.json`

Not supported yet in this first pass:

- `longmemeval_m_cleaned.json`

The recommended data setup from the official repository is:

```bash
mkdir -p data/
cd data/
wget https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json
wget https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json
```

Repository entrypoints:

```bash
npm run bench:longmemeval:check -- /absolute/path/to/longmemeval.json
npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json
```

OpenAI-compatible evaluator override:

- keep `repoRoot` pointed at the official `LongMemEval` clone
- set `evaluator.mode` to `openai-compatible`
- provide `evaluator.apiKey`
- provide `evaluator.baseURL`
- provide `evaluator.model` when the upstream `metricModel` alias does not match the provider model name

This override keeps the official evaluator file as the readiness baseline, but runs the answer-judging step through the repository-local compatible evaluator wrapper.

Generated artifacts:

- `hypotheses.jsonl`
- `hypotheses.jsonl.eval-results-<metricModel>`
- standardized `summary.json`

## Current status

As of `2026-03-29`, the benchmark status in this repository is:

- local fixture smoke benchmark is implemented
- external adapter wrapper entrypoints are implemented
- `LongMemEval` is the only benchmark with a repo-local adapter implementation
- `MemoryAgentBench`, `LoCoMo`, `Mem2ActBench`, and `MemBench` are still adapter-registry entries only

Verified benchmark outcomes from this development cycle:

- `LongMemEval` 2-sample OpenRouter smoke on `longmemeval_oracle.json` completed with:
  - `sampleCount = 2`
  - `overallAccuracy = 1`
- one full `LongMemEval` `longmemeval_oracle.json` run failed before hypothesis output with:
  - `sampleCount = 0`
  - `status = failed`
  - `error = Failed to generate embedding from openrouter.ai: Cannot read properties of undefined (reading '0')`

Skill source for re-running the benchmark suite is tracked in:

- [skills/memory-benchmark-suite/SKILL.md](/Users/chenjiyong/learning/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md)
- [skills/memory-benchmark-suite/benchmark-runbook.md](/Users/chenjiyong/learning/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md)

When datasets are not checked into this repository, each adapter should still document:

- required input files
- expected directory layout
- command to run
- output JSON schema
- pass/fail threshold

## Release gate

A candidate release should only pass when all of the following are true:

1. `npm test` passes.
2. `npm run test:openclaw-host` passes.
3. `npm run bench:fixtures` passes.
4. OpenClaw smoke commands pass:
   - `openclaw config validate`
   - `openclaw plugins info memory-lancedb-pro`
   - `openclaw memory-pro doctor --json`
   - `openclaw memory-pro stats --json`
5. Real benchmark adapters, when configured, show overall positive delta with no obvious single-benchmark regression.

## Notes

- Use fixture smoke as the minimum local gate.
- Use host functional and real OpenClaw smoke before trusting benchmark wins.
- Do not optimize for one benchmark by breaking continuity or OpenClaw stability.
