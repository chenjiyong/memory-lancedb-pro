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
- `datasetRoot`
- `outputPath`
- `command`

Example:

```json
{
  "adapter": "MemoryAgentBench",
  "datasetRoot": "/absolute/path/to/memory-agent-bench",
  "outputPath": "/absolute/path/to/reports/memory-agent-bench-result.json",
  "command": [
    "python",
    "/absolute/path/to/run_adapter.py",
    "--dataset",
    "{datasetRoot}",
    "--output",
    "{outputPath}"
  ]
}
```

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
