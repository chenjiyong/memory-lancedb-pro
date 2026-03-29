# Memory Benchmark Runbook

## Repository Matrix

| Benchmark | Official source | Repo-local support | Verified local entrypoint |
| --- | --- | --- | --- |
| MemoryAgentBench | [HUST-AI-HYZ/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench) | adapter name only | none |
| LongMemEval | [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval) | implemented | `npm run bench:longmemeval:check`, `npm run bench:longmemeval:run` |
| LoCoMo | [snap-research/locomo](https://github.com/snap-research/locomo) | adapter name only | none |
| Mem2ActBench | [arXiv:2601.19935](https://arxiv.org/abs/2601.19935) | adapter name only | none |
| MemBench | [import-myself/Membench](https://github.com/import-myself/Membench) | adapter name only | none |

## LongMemEval

### Official source

- Repo: [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval)
- Official testing notes:
  - save answers as `jsonl` with `question_id` and `hypothesis`
  - run `src/evaluation/evaluate_qa.py`

### This repository

- Config template:
  - [scripts/bench/configs/longmemeval.example.json](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/configs/longmemeval.example.json)
- Commands:
  - `npm run bench:longmemeval:check -- /absolute/path/to/longmemeval.json`
  - `npm run bench:longmemeval:run -- /absolute/path/to/longmemeval.json`
- Generated artifacts:
  - `hypotheses.jsonl`
  - `hypotheses.jsonl.eval-results-<metricModel>`
  - standardized `summary.json`

### Verified status in this repository

- Implemented local adapter files:
  - [scripts/bench/longmemeval/adapter.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/longmemeval/adapter.mjs)
  - [scripts/bench/longmemeval/harness.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/longmemeval/harness.mjs)
  - [scripts/bench/longmemeval/evaluate-qa-compatible.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/longmemeval/evaluate-qa-compatible.mjs)
- Verified smoke result from this development cycle:
  - `longmemeval_oracle.json` 2-sample OpenRouter smoke passed with `overallAccuracy = 1`
- Verified full-run result from this development cycle:
  - one full `oracle` run failed with `Failed to generate embedding from openrouter.ai: Cannot read properties of undefined (reading '0')`

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
  - listed in [scripts/bench/adapter-registry.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle

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
  - listed in [scripts/bench/adapter-registry.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle

## Mem2ActBench

### Verified source in this turn

- Paper: [Mem2ActBench: A Benchmark for Evaluating Long-Term Memory Utilization in Task-Oriented Autonomous Agents](https://arxiv.org/abs/2601.19935)

### Verified benchmark facts from the paper abstract

- dataset size: `2,029` sessions
- benchmark task set: `400` tool-use tasks
- focus: active memory use for tool selection and parameter grounding

### This repository

- Current status:
  - listed in [scripts/bench/adapter-registry.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
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
  - listed in [scripts/bench/adapter-registry.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/scripts/bench/adapter-registry.mjs)
  - no repo-local adapter implementation was added in this development cycle
  - no end-to-end official evaluation command was verified from the fetched README lines in this development cycle
