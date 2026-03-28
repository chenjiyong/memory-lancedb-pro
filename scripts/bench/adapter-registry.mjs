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
    configTemplate: {
      adapter: entry.name,
      datasetRoot: `/absolute/path/to/${entry.configStem}`,
      outputPath: `/absolute/path/to/reports/${entry.configStem}-result.json`,
      command: ["python", "/absolute/path/to/run_adapter.py", "--dataset", "{datasetRoot}", "--output", "{outputPath}"],
    },
  }));
}
