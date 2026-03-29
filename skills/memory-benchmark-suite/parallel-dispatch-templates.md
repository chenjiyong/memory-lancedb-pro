# Parallel Child-Session Dispatch Templates

Use these templates when the user asks to run multiple benchmark child sessions in parallel.

## Common Dispatch Contract

Apply all of the following to every child session:
- read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md`
- read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md`
- use official benchmark sources only
- use a benchmark-specific working directory, output path, and log path
- do not affect any already-running benchmark process
- do not modify `/Users/jige/work/memory-lancedb-pro` unless the user explicitly asked for repository changes
- stop at confirmed source gaps instead of inventing commands
- report facts only: source, commands, sample scope, artifacts, status, blockers, metrics

## MemoryAgentBench Template

```text
Run a partial MemoryAgentBench test in a dedicated child session.

Requirements:
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md`.
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md`.
- Use the official MemoryAgentBench repository as source of truth.
- Work in a dedicated benchmark directory.
- Use a dedicated output directory and a dedicated log file path.
- Do not affect any already-running benchmark process.
- Do not modify `/Users/jige/work/memory-lancedb-pro`.
- Run only a partial or smoke scope unless the user explicitly asked for full scale.
- Return only facts: official source, actual commands, sample scope, artifact paths, observed metrics, blockers.
```

## LoCoMo Template

```text
Run a partial LoCoMo test in a dedicated child session.

Requirements:
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md`.
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md`.
- Use the official LoCoMo repository as source of truth.
- Work in a dedicated benchmark directory.
- Use a dedicated output directory and a dedicated log file path.
- Do not affect any already-running benchmark process.
- Do not modify `/Users/jige/work/memory-lancedb-pro`.
- Run only a partial or smoke scope unless the user explicitly asked for full scale.
- If the official script or dataset hits an observed source-side failure, stop at the confirmed blocker and report it.
- Return only facts: official source, actual commands, sample scope, artifact paths, observed metrics, blockers.
```

## MemBench Template

```text
Run a partial MemBench test in a dedicated child session.

Requirements:
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md`.
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md`.
- Use the official MemBench repository as source of truth.
- Work in a dedicated benchmark directory.
- Use a dedicated output directory and a dedicated log file path.
- Do not affect any already-running benchmark process.
- Do not modify `/Users/jige/work/memory-lancedb-pro`.
- Run only a partial or smoke scope unless the user explicitly asked for full scale.
- If no end-to-end official command is verified, document the gap and only run what is directly supported by the verified official materials.
- Return only facts: official source, actual commands, sample scope, artifact paths, observed metrics, blockers.
```

## LongMemEval Template

```text
Run a partial LongMemEval test in a dedicated child session.

Requirements:
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/SKILL.md`.
- Read `/Users/jige/work/memory-lancedb-pro/skills/memory-benchmark-suite/benchmark-runbook.md`.
- Use the repo-local LongMemEval adapter in `/Users/jige/work/memory-lancedb-pro` and the official LongMemEval repository for source validation.
- Work in a dedicated benchmark directory.
- Use a dedicated output directory and a dedicated log file path.
- Do not affect any already-running benchmark process.
- Do not modify `/Users/jige/work/memory-lancedb-pro` unless the user explicitly asked for repository changes.
- Run only a partial or smoke scope unless the user explicitly asked for full scale.
- Record the exact config path, dataset path, summary path, and artifact directory.
- Return only facts: official source, actual commands, sample scope, artifact paths, observed metrics, blockers.
```
