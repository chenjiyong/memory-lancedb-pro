export const benchmarkAdapters = [
  {
    name: "MemoryAgentBench",
    configStem: "memory-agent-bench",
    focus: "agent memory retention and task continuity",
  },
  {
    name: "LongMemEval",
    configStem: "long-mem-eval",
    focus: "long-horizon memory recall quality",
  },
  {
    name: "LoCoMo",
    configStem: "locomo",
    focus: "long-context memory orchestration",
  },
  {
    name: "Mem2ActBench",
    configStem: "mem2act-bench",
    focus: "action selection backed by recalled memory",
  },
  {
    name: "MemBench",
    configStem: "mem-bench",
    focus: "general long-term memory benchmark coverage",
  },
];

export function getBenchmarkAdapter(name) {
  return benchmarkAdapters.find((entry) => entry.name === name);
}

export function listBenchmarkAdapters() {
  return benchmarkAdapters.map((entry) => ({
    name: entry.name,
    focus: entry.focus,
    configTemplate: entry.name === "LongMemEval"
      ? {
          adapter: "LongMemEval",
          repoRoot: "/absolute/path/to/LongMemEval",
          datasetRoot: "/absolute/path/to/LongMemEval/data",
          datasetFile: "longmemeval_s_cleaned.json",
          artifactsDir: "/absolute/path/to/reports/longmemeval-artifacts",
          outputPath: "/absolute/path/to/reports/longmemeval-summary.json",
          embedding: {
            provider: "openai-compatible",
            apiKey: "${EMBEDDING_API_KEY}",
            model: "text-embedding-3-small",
            baseURL: "https://api.openai.com/v1",
          },
          reader: {
            mode: "llm",
            auth: "api-key",
            apiKey: "${OPENAI_API_KEY}",
            model: "gpt-4o-mini",
            baseURL: "https://api.openai.com/v1",
            timeoutMs: 30000,
          },
          metricModel: "gpt-4o",
          evaluator: {
            mode: "openai-compatible",
            apiKey: "${OPENAI_API_KEY}",
            baseURL: "https://api.openai.com/v1",
            model: "gpt-4o-mini",
            timeoutMs: 30000,
          },
        }
      : {
          adapter: entry.name,
          datasetRoot: `/absolute/path/to/${entry.configStem}`,
          outputPath: `/absolute/path/to/reports/${entry.configStem}-result.json`,
          command: ["python", "/absolute/path/to/run_adapter.py", "--dataset", "{datasetRoot}", "--output", "{outputPath}"],
        },
  }));
}
