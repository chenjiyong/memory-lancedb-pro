---
name: memory-benchmark-suite
description: Use when running or reproducing MemoryAgentBench, LongMemEval, LoCoMo, Mem2ActBench, or MemBench for memory-lancedb-pro or another memory system.
---

# Memory Benchmark Suite

## Overview

Use this skill when you need a fact-based runbook for the memory benchmarks referenced by this repository.

The current repository status is:

- `LongMemEval`: repo-local adapter implemented
- `MemoryAgentBench`: listed in adapter registry, but no repo-local adapter implementation
- `LoCoMo`: listed in adapter registry, but no repo-local adapter implementation
- `Mem2ActBench`: listed in adapter registry, but no repo-local adapter implementation
- `MemBench`: listed in adapter registry, but no repo-local adapter implementation

## Rules

- Use official benchmark repositories or papers as the source of truth.
- Do not assume a repo-local adapter exists just because a benchmark name appears in `scripts/bench/adapter-registry.mjs`.
- If a benchmark does not have a verified public repo or verified run command in the current notes, stop at the confirmed source gap instead of inventing a command.

## Quick Reference

- Local fixture smoke:
  - `npm run bench:fixtures`
- List supported adapter names:
  - `npm run bench:adapters`
- Repo-local LongMemEval readiness:
  - `npm run bench:longmemeval:check -- /absolute/path/to/longmemeval.json`
- Repo-local LongMemEval run:
  - `npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json`

## Benchmarks

### LongMemEval

- Official repo: [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval)
- Local support in this repository: yes
- Supported local datasets:
  - `longmemeval_oracle.json`
  - `longmemeval_s_cleaned.json`
- Not supported locally in this first pass:
  - `longmemeval_m_cleaned.json`
- Use the repo-local adapter workflow in `docs/benchmarks.md` and `scripts/bench/configs/longmemeval.example.json`.

### MemoryAgentBench

- Official repo: [HUST-AI-HYZ/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench)
- Local support in this repository: adapter name only
- Verified from official README in this turn:
  - create `conda` env with Python `3.10.16`
  - `pip install torch`
  - `pip install -r requirements.txt`
  - `pip install "numpy<2"`
  - configure `.env`
  - run `bash bash_files/eniac/run_memagent_longcontext.sh` or `bash bash_files/eniac/run_memagent_rag_agents.sh`

### LoCoMo

- Official repo: [snap-research/locomo](https://github.com/snap-research/locomo)
- Local support in this repository: adapter name only
- Verified from official README in this turn:
  - dataset lives in `data/locomo10.json`
  - configuration is driven by `scripts/env.sh`
  - QA evaluation scripts include:
    - `bash scripts/evaluate_gpts.sh`
    - `bash scripts/evaluate_claude.sh`
    - `bash scripts/evaluate_gemini.sh`
    - `bash scripts/evaluate_hf_llm.sh`
  - RAG QA script:
    - `bash scripts/evaluate_rag_gpts.sh`

### Mem2ActBench

- Verified source in this turn: [arXiv:2601.19935](https://arxiv.org/abs/2601.19935)
- Local support in this repository: adapter name only
- Public benchmark repository and runnable command were not verified in this turn.

### MemBench

- Official repo: [import-myself/Membench](https://github.com/import-myself/Membench)
- Local support in this repository: adapter name only
- Verified from official README in this turn:
  - dataset download links are published
  - sampled `0-10k` and `100k` datasets are referenced in `data2test`
  - noise generation examples are provided via `makenoise.py`
- An end-to-end official evaluation command was not verified from the fetched README lines in this turn.

## Detailed Runbook

See [benchmark-runbook.md](./benchmark-runbook.md).
