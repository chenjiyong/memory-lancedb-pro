import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeLongMemEvalCases, runLongMemEvalHarness } from "./harness.mjs";
import { runCompatibleEvaluator } from "./evaluate-qa-compatible.mjs";

export const LONGMEMEVAL_DATASET_FILES = new Set([
  "longmemeval_s_cleaned.json",
  "longmemeval_oracle.json",
]);

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeReader(reader) {
  if (!reader || typeof reader !== "object") return null;
  return {
    mode: reader.mode,
    auth: reader.auth,
    model: reader.model,
    baseURL: reader.baseURL,
    timeoutMs: reader.timeoutMs,
    oauthProvider: reader.oauthProvider,
    oauthPath: reader.oauthPath,
  };
}

function sanitizeEvaluator(evaluator) {
  if (!evaluator || typeof evaluator !== "object") return null;
  return {
    mode: evaluator.mode,
    model: evaluator.model,
    baseURL: evaluator.baseURL,
    timeoutMs: evaluator.timeoutMs,
    headers: evaluator.headers,
  };
}

function evaluateThresholds(metrics, thresholds) {
  if (!thresholds || typeof thresholds !== "object") {
    return "measured";
  }

  const overallMin = typeof thresholds.overallAccuracyMin === "number"
    ? thresholds.overallAccuracyMin
    : null;
  const perQuestionTypeMin =
    thresholds.perQuestionTypeMin && typeof thresholds.perQuestionTypeMin === "object"
      ? thresholds.perQuestionTypeMin
      : {};

  if (overallMin == null && Object.keys(perQuestionTypeMin).length === 0) {
    return "measured";
  }

  if (overallMin != null && metrics.overallAccuracy < overallMin) {
    return "failed";
  }

  for (const [questionType, minValue] of Object.entries(perQuestionTypeMin)) {
    if (typeof minValue !== "number") continue;
    if ((metrics.perQuestionType[questionType] ?? 0) < minValue) {
      return "failed";
    }
  }

  return "passed";
}

function buildFailedSummary(config, readiness, error) {
  return {
    adapter: "LongMemEval",
    datasetFile: config.datasetFile,
    metricModel: config.metricModel,
    overallAccuracy: 0,
    perQuestionType: {},
    sampleCount: 0,
    artifacts: {
      hypothesesPath: path.join(config.artifactsDir, "hypotheses.jsonl"),
      officialEvalPath: path.join(config.artifactsDir, `hypotheses.jsonl.eval-results-${config.metricModel}`),
      summaryPath: config.outputPath,
    },
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
    ready: readiness.ready,
    issues: readiness.issues,
  };
}

export async function buildLongMemEvalReadinessSummary(config) {
  const issues = [];
  const datasetPath = path.join(config.datasetRoot || "", config.datasetFile || "");
  const evaluatorPath = path.join(config.repoRoot || "", "src", "evaluation", "evaluate_qa.py");
  const readmePath = path.join(config.repoRoot || "", "README.md");
  const requirementsLitePath = path.join(config.repoRoot || "", "requirements-lite.txt");

  if (!config.repoRoot) {
    issues.push("repoRoot is required");
  } else if (!(await pathExists(config.repoRoot))) {
    issues.push(`repoRoot does not exist: ${config.repoRoot}`);
  }

  if (config.repoRoot && !(await pathExists(readmePath))) {
    issues.push(`repoRoot is missing README.md: ${readmePath}`);
  }
  if (config.repoRoot && !(await pathExists(requirementsLitePath))) {
    issues.push(`repoRoot is missing requirements-lite.txt: ${requirementsLitePath}`);
  }
  if (config.repoRoot && !(await pathExists(evaluatorPath))) {
    issues.push(`repoRoot is missing src/evaluation/evaluate_qa.py: ${evaluatorPath}`);
  }

  if (!config.datasetRoot) {
    issues.push("datasetRoot is required");
  } else if (!(await pathExists(config.datasetRoot))) {
    issues.push(`datasetRoot does not exist: ${config.datasetRoot}`);
  }

  if (!config.datasetFile) {
    issues.push("datasetFile is required");
  } else if (!LONGMEMEVAL_DATASET_FILES.has(config.datasetFile)) {
    issues.push(`unsupported datasetFile: ${config.datasetFile}`);
  }

  if (config.datasetRoot && config.datasetFile && LONGMEMEVAL_DATASET_FILES.has(config.datasetFile)) {
    if (!(await pathExists(datasetPath))) {
      issues.push(`dataset file does not exist: ${datasetPath}`);
    }
  }

  if (!config.outputPath) {
    issues.push("outputPath is required");
  }
  if (!config.artifactsDir) {
    issues.push("artifactsDir is required");
  }

  if (!config.reader || typeof config.reader !== "object") {
    issues.push("reader is required");
  } else {
    if (config.reader.mode !== "llm") {
      issues.push(`unsupported reader.mode: ${config.reader.mode}`);
    }
    if (!config.reader.model) {
      issues.push("reader.model is required");
    }
    if (!config.reader.auth) {
      issues.push("reader.auth is required");
    } else if (config.reader.auth === "api-key" && !config.reader.apiKey) {
      issues.push("reader.apiKey is required for api-key auth");
    } else if (config.reader.auth === "oauth" && !config.reader.oauthPath) {
      issues.push("reader.oauthPath is required for oauth auth");
    }
  }

  if (!config.embedding || typeof config.embedding !== "object") {
    issues.push("embedding is required");
  } else {
    if (!config.embedding.provider) {
      issues.push("embedding.provider is required");
    }
    if (!config.embedding.apiKey) {
      issues.push("embedding.apiKey is required");
    }
    if (!config.embedding.model) {
      issues.push("embedding.model is required");
    }
  }

  if (config.evaluator != null) {
    if (!config.evaluator || typeof config.evaluator !== "object") {
      issues.push("evaluator must be an object");
    } else if (config.evaluator.mode !== "openai-compatible") {
      issues.push(`unsupported evaluator.mode: ${config.evaluator.mode}`);
    } else {
      if (!config.evaluator.apiKey) {
        issues.push("evaluator.apiKey is required for openai-compatible mode");
      }
      if (!config.evaluator.baseURL) {
        issues.push("evaluator.baseURL is required for openai-compatible mode");
      }
      if (!config.evaluator.model && !config.metricModel) {
        issues.push("evaluator.model or metricModel is required for openai-compatible mode");
      }
    }
  }

  return {
    mode: "check",
    adapter: "LongMemEval",
    supported: true,
    ready: issues.length === 0,
    issues,
    repoRoot: config.repoRoot,
    datasetRoot: config.datasetRoot,
    datasetFile: config.datasetFile,
    datasetPath,
    evaluatorPath,
    outputPath: config.outputPath,
    artifactsDir: config.artifactsDir,
    metricModel: config.metricModel,
    reader: sanitizeReader(config.reader),
    evaluator: sanitizeEvaluator(config.evaluator),
  };
}

async function runEvaluator(config, hypothesesPath, referencePath) {
  if (config.evaluator?.mode === "openai-compatible") {
    return runCompatibleEvaluator(config.evaluator, config.metricModel, hypothesesPath, referencePath);
  }

  const evaluatorCwd = path.join(config.repoRoot, "src", "evaluation");
  const evaluatorPath = path.join(evaluatorCwd, "evaluate_qa.py");
  const pythonBin = process.env.PYTHON_BIN || "python3";

  let stdout = "";
  let stderr = "";

  const exit = await new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [evaluatorPath, config.metricModel, hypothesesPath, referencePath],
      {
        cwd: evaluatorCwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code: code ?? 1, signal }));
  });

  return {
    exitCode: exit.code,
    signal: exit.signal,
    stdout,
    stderr,
    officialEvalPath: `${hypothesesPath}.eval-results-${config.metricModel}`,
  };
}

async function parseOfficialEvalResults(referencePath, officialEvalPath) {
  const references = JSON.parse(await readFile(referencePath, "utf8"));
  const questionTypes = new Map(
    normalizeLongMemEvalCases(references).map((entry) => [entry.questionId, entry.questionType]),
  );
  const raw = await readFile(officialEvalPath, "utf8");
  const rows = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const counts = new Map();
  let correct = 0;

  for (const row of rows) {
    const questionType = questionTypes.get(String(row.question_id)) || "unknown";
    const label = row?.autoeval_label?.label === true;
    const current = counts.get(questionType) || { total: 0, correct: 0 };
    current.total += 1;
    current.correct += label ? 1 : 0;
    counts.set(questionType, current);
    correct += label ? 1 : 0;
  }

  const perQuestionType = {};
  for (const [questionType, current] of counts.entries()) {
    perQuestionType[questionType] = current.total > 0 ? current.correct / current.total : 0;
  }

  return {
    overallAccuracy: rows.length > 0 ? correct / rows.length : 0,
    perQuestionType,
    sampleCount: rows.length,
  };
}

export async function runLongMemEvalAdapter(config) {
  const readiness = await buildLongMemEvalReadinessSummary(config);
  if (!readiness.ready) {
    return {
      ...readiness,
      mode: "run",
      exitCode: 1,
      signal: null,
      outputExists: false,
      result: null,
    };
  }

  try {
    await mkdir(path.dirname(config.outputPath), { recursive: true });
    await mkdir(config.artifactsDir, { recursive: true });

    const datasetPath = path.join(config.datasetRoot, config.datasetFile);
    const rawDataset = JSON.parse(await readFile(datasetPath, "utf8"));
    const cases = normalizeLongMemEvalCases(rawDataset);
    const harnessResult = await runLongMemEvalHarness({
      ...config,
      cases,
    });
    const evaluatorResult = await runEvaluator(config, harnessResult.hypothesesPath, datasetPath);

    if (evaluatorResult.exitCode !== 0 || evaluatorResult.signal) {
      throw new Error(
        `LongMemEval evaluator failed with code ${evaluatorResult.exitCode}${evaluatorResult.signal ? ` signal ${evaluatorResult.signal}` : ""}\n${[evaluatorResult.stdout, evaluatorResult.stderr].filter(Boolean).join("\n")}`,
      );
    }

    const metrics = await parseOfficialEvalResults(datasetPath, evaluatorResult.officialEvalPath);
    const status = evaluateThresholds(metrics, config.thresholds);
    const summary = {
      adapter: "LongMemEval",
      datasetFile: config.datasetFile,
      metricModel: config.metricModel,
      overallAccuracy: metrics.overallAccuracy,
      perQuestionType: metrics.perQuestionType,
      sampleCount: metrics.sampleCount,
      artifacts: {
        hypothesesPath: harnessResult.hypothesesPath,
        officialEvalPath: evaluatorResult.officialEvalPath,
        summaryPath: config.outputPath,
      },
      status,
    };

    await writeFile(config.outputPath, `${formatJson(summary)}\n`, "utf8");

    return {
      ...readiness,
      mode: "run",
      exitCode: status === "failed" ? 1 : 0,
      signal: null,
      outputExists: true,
      result: summary,
    };
  } catch (error) {
    const failedSummary = buildFailedSummary(config, readiness, error);
    try {
      await mkdir(path.dirname(config.outputPath), { recursive: true });
      await writeFile(config.outputPath, `${formatJson(failedSummary)}\n`, "utf8");
    } catch {}

    return {
      ...readiness,
      mode: "run",
      exitCode: 1,
      signal: null,
      outputExists: await pathExists(config.outputPath),
      result: failedSummary,
    };
  }
}
