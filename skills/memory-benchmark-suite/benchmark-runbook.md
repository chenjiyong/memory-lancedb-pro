# Memory Benchmark Runbook

## Repository Matrix

| Benchmark | Official source | Repo-local support | Verified local entrypoint |
| --- | --- | --- | --- |
| MemoryAgentBench | [HUST-AI-HYZ/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench) | adapter name only | none |
| LongMemEval | [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval) | implemented | `npm run bench:longmemeval:check`, `npm run bench:longmemeval:run` |
| LoCoMo | [snap-research/locomo](https://github.com/snap-research/locomo) | adapter name only | none |
| Mem2ActBench | [arXiv:2601.19935](https://arxiv.org/abs/2601.19935) | adapter name only | none |
| MemBench | [import-myself/Membench](https://github.com/import-myself/Membench) | adapter name only | none |

## Parallel Benchmark Session Dispatch

Use this section when the user wants multiple benchmark child sessions running in parallel.

### Preflight

Before dispatch:
- record already-running benchmark processes
- choose the benchmark set to run in parallel
- assign one child session per benchmark
- assign a distinct output directory and log path for each child session
- record whether each child session uses a shared provider key or a distinct key
- verify that no child session will reuse another run's artifact directory

### Required Child-Session Context

Every child session should receive:
- benchmark name
- official source to use as ground truth
- local repository status in `/Users/jige/work/memory-lancedb-pro`
- exact benchmark root or clone directory to use
- sample scope, if the user asked for partial runs only
- provider and credential constraints supplied by the user
- explicit instruction not to affect any already-running benchmark process
- explicit instruction to report facts only

### Isolation Rules

For every parallel child session:
- use an isolated working directory or isolated benchmark output subtree
- use a unique log file path
- use a unique result path
- do not delete another benchmark's temp, output, or artifact directories
- do not modify `/Users/jige/work/memory-lancedb-pro` unless the user asked for repository changes
- do not stop sibling benchmark sessions

### Result Collection Fields

Collect these fields from each child session before the final rollup:
- official source used
- actual commands executed
- sample or dataset scope
- artifact paths
- status
- blockers
- observed metrics
- known limitations or source gaps

### Final Rollup Rules

- keep each benchmark in its own section first
- do not merge incomparable metrics into one synthetic score
- only produce the final summary table after all child sessions have returned
- if one child session stops at a source gap, preserve that status instead of replacing it with an inferred result

## LongMemEval

### Official source

- Repo: [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval)
- Official testing notes:
  - save answers as `jsonl` with `question_id` and `hypothesis`
  - run `src/evaluation/evaluate_qa.py`

### This repository

- Config template:
  - [/Users/jige/work/memory-lancedb-pro/scripts/bench/configs/longmemeval.example.json](/Users/jige/work/memory-lancedb-pro/scripts/bench/configs/longmemeval.example.json)
- Commands:
  - `npm run bench:longmemeval:check -- /absolute/path/to/longmemeval.json`
  - `npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json`
- Generated artifacts:
  - `hypotheses.jsonl`
  - `hypotheses.jsonl.eval-results-<metricModel>`
  - standardized `summary.json`

### Verified status in this repository

- Implemented local adapter files:
  - [/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/adapter.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/adapter.mjs)
  - [/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/harness.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/harness.mjs)
  - [/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/evaluate-qa-compatible.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/longmemeval/evaluate-qa-compatible.mjs)
- Verified smoke result from this development cycle:
  - `longmemeval_oracle.json` 2-sample OpenRouter smoke passed with `overallAccuracy = 0.5`
- Verified partial-run result from this development cycle:
  - `longmemeval_oracle.json` 50-sample partial run completed with `overallAccuracy = 0.44`
- Verified full-run observation from this development cycle:
  - one full `oracle` run was started and later paused without intermediate summary output because the current harness writes `hypotheses.jsonl` after the case loop completes

## MemoryAgentBench

### Official source

- Repo: [HUST-AI-HYZ/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench)

### Verified setup from official README

- `conda create --name MABench python=3.10.16`
- `pip install torch`
- `pip install -r requirements.txt`
- `pip install "numpy<2"`
- Optional package workaround when `cognee` or `letta` dependencies fail:
  - `pip install letta`
  - `pip uninstall letta`
  - `pip install cognee`
  - `pip uninstall cognee`
- `.env` keys noted in README:
  - `OPENAI_API_KEY`
  - `LLM_MODEL`
  - `LLM_API_KEY`
  - `Anthropic_API_KEY`
  - `Google_API_KEY`

### Verified run commands from official README

- Long-context agents:
  - `bash bash_files/eniac/run_memagent_longcontext.sh`
- RAG agents and memory methods:
  - `bash bash_files/eniac/run_memagent_rag_agents.sh`
- Chunk-size ablation:
  - `bash bash_files/eniac/run_memagent_rag_agents_chunksize.sh`
- LLM metric scripts:
  - `python llm_based_eval/longmem_qa_evaluate.py`
  - `python llm_based_eval/summarization_evaluate.py`

### This repository

- Current status:
  - listed in [/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle

### Verified observed results from this development cycle

- 1-sample official smoke run completed with perfect metrics on that single sample
- 50-sample partial run completed with:
  - `f1 = 9.41293109954902`
  - `exact_match = 0`

## LoCoMo

### Official source

- Repo: [snap-research/locomo](https://github.com/snap-research/locomo)

### Verified setup and commands from official README

- dataset file in repo:
  - `data/locomo10.json`
- configuration file noted by README:
  - `scripts/env.sh`
- QA evaluation:
  - `bash scripts/evaluate_gpts.sh`
  - `bash scripts/evaluate_claude.sh`
  - `bash scripts/evaluate_gemini.sh`
  - `bash scripts/evaluate_hf_llm.sh`
- observations and session summaries:
  - `bash scripts/generate_observations.sh`
  - `bash scripts/generate_session_summaries.sh`
- retrieval-augmented QA:
  - `bash scripts/evaluate_rag_gpts.sh`

### This repository

- Current status:
  - listed in [/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle

### Verified observed results from this development cycle

- smoke subset result observed:
  - `80 QA` with `overall_accuracy = 0.318`
- observed issue during one smoke attempt:
  - official-script path hit `KeyError: 'answer'` on a category-5 example before the later 80-QA output was produced

## Mem2ActBench

### Verified source in this turn

- Paper: [Mem2ActBench: A Benchmark for Evaluating Long-Term Memory Utilization in Task-Oriented Autonomous Agents](https://arxiv.org/abs/2601.19935)

### Verified benchmark facts from the paper abstract

- dataset size: `2,029` sessions
- benchmark task set: `400` tool-use tasks
- focus: active memory use for tool selection and parameter grounding

### This repository

- Current status:
  - listed in [/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no public benchmark repository or runnable command was verified in this development cycle
  - no repo-local adapter implementation was added in this development cycle

## MemBench

### Official source

- Repo: [import-myself/Membench](https://github.com/import-myself/Membench)

### Verified setup facts from official README

- dataset download links are published in README
- README references sampled datasets in `data2test`
- README includes noise generation examples through `makenoise.py`

### Verified examples from official README

- `MakeNoiseMessageHighLevel('data/ThirdAgentDataHighLevel.json', 'data2test', length=10, sample_num=100)`
- `MakeNoiseMessage('data/ThirdAgentDataLowLevel.json', 'data2test', length=10, sample_num=100)`
- `MakeNoiseSession('data/FirstAgentDataLowLevel.json', 'data2test', length=10, sample_num=100)`
- `MakeNoiseSession('data/FirstAgentDataHighLevel.json', 'data2test', length=10, sample_num=100)`

### This repository

- Current status:
  - listed in [/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs](/Users/jige/work/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle
  - no end-to-end official evaluation command was verified from the fetched README lines in this development cycle

### Verified observed results from this development cycle

- 50-sample partial run completed with:
  - `accuracy = 0.96`
  - `avg_recall = 1.0`
