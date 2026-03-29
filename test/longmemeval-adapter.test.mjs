import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { chunkSessionTurns, serializeLongMemEvalSession } from "../scripts/bench/longmemeval/harness.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "bench", "run-adapter-bench.mjs");

function createEmbeddingVector(text) {
  const normalized = String(text || "").toLowerCase();
  return [
    normalized.includes("tea") ? 1 : 0,
    normalized.includes("coffee") ? 1 : 0,
    normalized.includes("travel") ? 1 : 0,
    Math.min(1, normalized.length / 500),
  ];
}

async function startEmbeddingServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/embeddings") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    const inputs = Array.isArray(parsed.input) ? parsed.input : [parsed.input];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      object: "list",
      data: inputs.map((item, index) => ({
        object: "embedding",
        index,
        embedding: createEmbeddingVector(item),
      })),
      model: parsed.model || "mock-embed-4d",
      usage: {
        prompt_tokens: inputs.length,
        total_tokens: inputs.length,
      },
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function startLlmServer() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    requests.push(parsed);

    const systemPrompt = String(parsed.messages?.[0]?.content || "");
    const userPrompt = String(parsed.messages?.[1]?.content || "");
    let content = "insufficient information";

    if (/memory extraction assistant/i.test(systemPrompt)) {
      const lowered = userPrompt.toLowerCase();
      if (lowered.includes("tea")) {
        content = "{\"memories\":[{\"category\":\"preferences\",\"abstract\":\"tea drink preference\",\"overview\":\"## Preference\\n- Drink: tea\",\"content\":\"The user's preferred drink is tea.\"}]}";
      } else if (lowered.includes("coffee")) {
        content = "{\"memories\":[{\"category\":\"preferences\",\"abstract\":\"coffee drink preference\",\"overview\":\"## Preference\\n- Drink: coffee\",\"content\":\"The user's preferred drink is coffee.\"}]}";
      } else {
        content = "{\"memories\":[]}";
      }
    } else {
      const lowered = userPrompt.toLowerCase();
      if (lowered.includes("preferred drink is tea") || lowered.includes("tea drink preference")) {
        content = "tea";
      } else if (lowered.includes("preferred drink is coffee") || lowered.includes("coffee drink preference")) {
        content = "coffee";
      } else {
        content = "insufficient information";
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function startTemporalReasoningLlmServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    const systemPrompt = String(parsed.messages?.[0]?.content || "");
    const userPrompt = String(parsed.messages?.[1]?.content || "");
    let content = "insufficient information";

    if (/memory extraction assistant/i.test(systemPrompt)) {
      if (userPrompt.includes("car serviced")) {
        content = "{\"memories\":[{\"category\":\"events\",\"abstract\":\"User got car serviced on March 15th, had a great experience.\",\"overview\":\"## Event Details\\n- Date: March 15th\\n- Activity: Car servicing\\n- Outcome: Great experience\",\"content\":\"User had their car serviced for the first time on March 15th and reported a great experience.\"}]}";
      } else if (userPrompt.includes("GPS system")) {
        content = "{\"memories\":[{\"category\":\"cases\",\"abstract\":\"GPS system issue on 3/22 -> Entire system replaced by dealership.\",\"overview\":\"## Problem\\n- Issue: GPS system malfunction\\n- Date: 3/22\\n\\n## Solution\\n- Action: Took the car to the dealership\\n- Outcome: Entire GPS system replaced and is now working flawlessly.\",\"content\":\"User experienced an issue with their car's GPS system on March 22, which required them to take it back to the dealership. The dealership replaced the entire system, and now it is working flawlessly.\"}]}";
      } else {
        content = "{\"memories\":[]}";
      }
    } else if (
      userPrompt.includes("Reason across dates, order, and sequence") &&
      /car serviced/i.test(userPrompt) &&
      /GPS system/i.test(userPrompt)
    ) {
      content = "GPS system issue";
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function startEvaluatorServer() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    requests.push(parsed);
    const prompt = String(parsed.messages?.[0]?.content || "");
    const yes =
      (prompt.includes("Correct Answer: tea") && prompt.includes("Model Response: tea")) ||
      (prompt.includes("Rubric: tea") && prompt.includes("Model Response: tea")) ||
      (prompt.includes("Explanation:") && prompt.toLowerCase().includes("insufficient information"));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      choices: [
        {
          message: {
            content: yes ? "yes" : "no",
          },
        },
      ],
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function createFakeLongMemEvalRepo(baseDir) {
  const repoDir = path.join(baseDir, "LongMemEval");
  const evaluationDir = path.join(repoDir, "src", "evaluation");
  await mkdir(evaluationDir, { recursive: true });
  await writeFile(path.join(repoDir, "README.md"), "# LongMemEval\n");
  await writeFile(path.join(repoDir, "requirements-lite.txt"), "numpy\n");
  await writeFile(
    path.join(evaluationDir, "evaluate_qa.py"),
    [
      "import json",
      "import sys",
      "",
      "metric_model = sys.argv[1]",
      "hyp_file = sys.argv[2]",
      "ref_file = sys.argv[3]",
      "result_file = hyp_file + '.eval-results-' + metric_model",
      "with open(hyp_file, 'r', encoding='utf-8') as f:",
      "    hypotheses = [json.loads(line) for line in f if line.strip()]",
      "with open(ref_file, 'r', encoding='utf-8') as f:",
      "    references = json.load(f)",
      "qid_to_ref = {entry['question_id']: entry for entry in references}",
      "logs = []",
      "for hyp in hypotheses:",
      "    ref = qid_to_ref[hyp['question_id']]",
      "    label = str(hyp['hypothesis']).strip().lower() == str(ref['answer']).strip().lower()",
      "    logs.append({",
      "        'question_id': hyp['question_id'],",
      "        'hypothesis': hyp['hypothesis'],",
      "        'autoeval_label': {'model': metric_model, 'label': label}",
      "    })",
      "with open(result_file, 'w', encoding='utf-8') as f:",
      "    for entry in logs:",
      "        f.write(json.dumps(entry) + '\\n')",
      "accuracy = sum(1 for entry in logs if entry['autoeval_label']['label']) / len(logs)",
      "print('Accuracy:', round(accuracy, 4))",
      "print('Saved to', result_file)",
    ].join("\n"),
  );
  return repoDir;
}

async function createFailingLongMemEvalRepo(baseDir) {
  const repoDir = path.join(baseDir, "LongMemEval");
  const evaluationDir = path.join(repoDir, "src", "evaluation");
  await mkdir(evaluationDir, { recursive: true });
  await writeFile(path.join(repoDir, "README.md"), "# LongMemEval\n");
  await writeFile(path.join(repoDir, "requirements-lite.txt"), "numpy\n");
  await writeFile(
    path.join(evaluationDir, "evaluate_qa.py"),
    [
      "import sys",
      "print('failing evaluator', file=sys.stderr)",
      "sys.exit(2)",
    ].join("\n"),
  );
  return repoDir;
}

test("LongMemEval session serialization preserves date and turn order", () => {
  const serialized = serializeLongMemEvalSession(
    "session-1",
    "2025-01-01",
    [
      { role: "user", content: "I really like tea." },
      { role: "assistant", content: "Noted." },
    ],
  );

  assert.match(serialized, /Session ID: session-1/);
  assert.match(serialized, /Session Date: 2025-01-01/);
  assert.match(serialized, /user: I really like tea\./);
  assert.match(serialized, /assistant: Noted\./);
  assert.ok(serialized.indexOf("user: I really like tea.") < serialized.indexOf("assistant: Noted."));
});

test("LongMemEval session chunking splits long sessions into overlapping windows", () => {
  const turns = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `turn-${index}`,
  }));

  const chunks = chunkSessionTurns(turns, 8, 2);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 8);
  assert.equal(chunks[1].length, 6);
  assert.equal(chunks[0][6].content, "turn-6");
  assert.equal(chunks[0][7].content, "turn-7");
  assert.equal(chunks[1][0].content, "turn-6");
  assert.equal(chunks[1][1].content, "turn-7");
});

test("LongMemEval adapter check reports missing repo, invalid dataset, and missing reader", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "longmemeval-check-"));
  const reportsDir = path.join(tempRoot, "reports");
  await mkdir(reportsDir, { recursive: true });
  const configPath = path.join(tempRoot, "longmemeval.json");

  await writeFile(
    configPath,
    JSON.stringify(
      {
        adapter: "LongMemEval",
        repoRoot: path.join(tempRoot, "missing-repo"),
        datasetRoot: path.join(tempRoot, "missing-data"),
        datasetFile: "longmemeval_m_cleaned.json",
        outputPath: path.join(reportsDir, "summary.json"),
        artifactsDir: path.join(reportsDir, "artifacts"),
      },
      null,
      2,
    ),
  );

  const { stdout } = await execFileAsync("node", [scriptPath, "--check", configPath], {
    cwd: repoRoot,
  });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.adapter, "LongMemEval");
  assert.equal(parsed.ready, false);
  assert.match(parsed.issues.join("\n"), /unsupported datasetFile/i);
  assert.match(parsed.issues.join("\n"), /repoRoot does not exist/i);
  assert.match(parsed.issues.join("\n"), /reader is required/i);
  assert.match(parsed.issues.join("\n"), /embedding is required/i);
});

test("LongMemEval adapter run produces hypotheses, official eval logs, and standardized summary", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "longmemeval-run-"));
  const datasetRoot = path.join(tempRoot, "dataset");
  const reportsDir = path.join(tempRoot, "reports");
  const artifactsDir = path.join(reportsDir, "artifacts");
  const outputPath = path.join(reportsDir, "summary.json");
  const configPath = path.join(tempRoot, "longmemeval.json");
  const repoDir = await createFakeLongMemEvalRepo(tempRoot);
  const embeddingServer = await startEmbeddingServer();
  const llmServer = await startLlmServer();

  try {
    await mkdir(datasetRoot, { recursive: true });
    await mkdir(reportsDir, { recursive: true });

    const dataset = [
      {
        question_id: "q1",
        question_type: "single-session-preference",
        question: "What drink does the user like?",
        answer: "tea",
        question_date: "2025-01-01",
        haystack_session_ids: ["s1"],
        haystack_dates: ["2025-01-01"],
        haystack_sessions: [
          [
            { role: "user", content: "I really like tea." },
            { role: "assistant", content: "Noted, you like tea." },
          ],
        ],
      },
      {
        question_id: "q2",
        question_type: "single-session-preference",
        question: "What drink does the user like?",
        answer: "insufficient information",
        question_date: "2025-01-02",
        haystack_session_ids: ["s2"],
        haystack_dates: ["2025-01-02"],
        haystack_sessions: [
          [
            { role: "user", content: "Let's talk about travel plans." },
            { role: "assistant", content: "Sure, where do you want to go?" },
          ],
        ],
      },
    ];

    await writeFile(
      path.join(datasetRoot, "longmemeval_s_cleaned.json"),
      JSON.stringify(dataset, null, 2),
    );

    await writeFile(
      configPath,
      JSON.stringify(
        {
          adapter: "LongMemEval",
          repoRoot: repoDir,
          datasetRoot,
          datasetFile: "longmemeval_s_cleaned.json",
          outputPath,
          artifactsDir,
          embedding: {
            provider: "openai-compatible",
            apiKey: "local-noauth",
            model: "mock-embed-4d",
            baseURL: embeddingServer.baseURL,
            dimensions: 4,
            chunking: true,
          },
          reader: {
            mode: "llm",
            auth: "api-key",
            apiKey: "local-noauth",
            model: "gpt-4o-mini",
            baseURL: llmServer.baseURL,
            timeoutMs: 5_000,
          },
          metricModel: "gpt-4o",
          thresholds: {
            overallAccuracyMin: 0.5,
            perQuestionTypeMin: {
              "single-session-preference": 0.5,
            },
          },
        },
        null,
        2,
      ),
    );

    const { stdout } = await execFileAsync("node", [scriptPath, "--run", configPath], {
      cwd: repoRoot,
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ready, true);
    assert.equal(parsed.outputExists, true);
    assert.equal(parsed.result.adapter, "LongMemEval");
    assert.equal(parsed.result.datasetFile, "longmemeval_s_cleaned.json");
    assert.equal(parsed.result.sampleCount, 2);
    assert.equal(parsed.result.overallAccuracy, 1);
    assert.equal(parsed.result.status, "passed");
    assert.equal(parsed.result.perQuestionType["single-session-preference"], 1);

    const hypotheses = await readFile(path.join(artifactsDir, "hypotheses.jsonl"), "utf8");
    assert.match(hypotheses, /"question_id":"q1"/);
    assert.match(hypotheses, /"hypothesis":"tea"/);
    assert.match(hypotheses, /"question_id":"q2"/);
    assert.match(hypotheses, /"hypothesis":"insufficient information"/);

    const officialEval = await readFile(path.join(artifactsDir, "hypotheses.jsonl.eval-results-gpt-4o"), "utf8");
    assert.match(officialEval, /"autoeval_label":/);

    const storedSummary = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(storedSummary.status, "passed");
    assert.equal(storedSummary.artifacts.hypothesesPath.endsWith("hypotheses.jsonl"), true);
    assert.equal(storedSummary.artifacts.officialEvalPath.endsWith(".eval-results-gpt-4o"), true);
  } finally {
    await llmServer.close();
    await embeddingServer.close();
  }
});

test("LongMemEval adapter writes a failed summary when the evaluator exits non-zero", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "longmemeval-fail-"));
  const datasetRoot = path.join(tempRoot, "dataset");
  const reportsDir = path.join(tempRoot, "reports");
  const artifactsDir = path.join(reportsDir, "artifacts");
  const outputPath = path.join(reportsDir, "summary.json");
  const configPath = path.join(tempRoot, "longmemeval.json");
  const repoDir = await createFailingLongMemEvalRepo(tempRoot);
  const embeddingServer = await startEmbeddingServer();
  const llmServer = await startLlmServer();

  try {
    await mkdir(datasetRoot, { recursive: true });
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      path.join(datasetRoot, "longmemeval_oracle.json"),
      JSON.stringify([
        {
          question_id: "q1",
          question_type: "single-session-preference",
          question: "What drink does the user like?",
          answer: "tea",
          question_date: "2025-01-01",
          haystack_session_ids: ["s1"],
          haystack_dates: ["2025-01-01"],
          haystack_sessions: [
            [
              { role: "user", content: "I really like tea." },
              { role: "assistant", content: "Noted, you like tea." },
            ],
          ],
        },
      ], null, 2),
    );

    await writeFile(
      configPath,
      JSON.stringify(
        {
          adapter: "LongMemEval",
          repoRoot: repoDir,
          datasetRoot,
          datasetFile: "longmemeval_oracle.json",
          outputPath,
          artifactsDir,
          embedding: {
            provider: "openai-compatible",
            apiKey: "local-noauth",
            model: "mock-embed-4d",
            baseURL: embeddingServer.baseURL,
            dimensions: 4,
            chunking: true,
          },
          reader: {
            mode: "llm",
            auth: "api-key",
            apiKey: "local-noauth",
            model: "gpt-4o-mini",
            baseURL: llmServer.baseURL,
            timeoutMs: 5_000,
          },
          metricModel: "gpt-4o",
        },
        null,
        2,
      ),
    );

    await assert.rejects(
      execFileAsync("node", [scriptPath, "--run", configPath], {
        cwd: repoRoot,
      }),
    );

    const storedSummary = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(storedSummary.status, "failed");
    assert.match(storedSummary.error, /LongMemEval evaluator failed/i);
  } finally {
    await llmServer.close();
    await embeddingServer.close();
  }
});

test("LongMemEval temporal reasoning prompt includes reasoning instructions and detailed memory context", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "longmemeval-temporal-reasoning-"));
  const datasetRoot = path.join(tempRoot, "dataset");
  const reportsDir = path.join(tempRoot, "reports");
  const artifactsDir = path.join(reportsDir, "artifacts");
  const outputPath = path.join(reportsDir, "summary.json");
  const configPath = path.join(tempRoot, "longmemeval.json");
  const repoDir = await createFakeLongMemEvalRepo(tempRoot);
  const embeddingServer = await startEmbeddingServer();
  const llmServer = await startTemporalReasoningLlmServer();

  try {
    await mkdir(datasetRoot, { recursive: true });
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      path.join(datasetRoot, "longmemeval_oracle.json"),
      JSON.stringify([
        {
          question_id: "temporal-q1",
          question_type: "temporal-reasoning",
          question: "What was the first issue I had with my new car after its first service?",
          answer: "GPS system issue",
          question_date: "2023/04/10 (Mon) 23:07",
          haystack_session_ids: ["s1", "s2"],
          haystack_dates: ["2023/04/10 (Mon) 17:50", "2023/04/10 (Mon) 14:47"],
          haystack_sessions: [
            [
              { role: "user", content: "I just got my car serviced for the first time on March 15th, and it was a great experience." },
              { role: "assistant", content: "Glad the service went well." },
            ],
            [
              { role: "user", content: "I recently had an issue with my car's GPS system on 3/22, and I had to take it back to the dealership to get it fixed. They replaced the entire system, and now it's working flawlessly." },
              { role: "assistant", content: "Good to hear the GPS issue was fixed." },
            ],
          ],
        },
      ], null, 2),
    );

    await writeFile(
      configPath,
      JSON.stringify(
        {
          adapter: "LongMemEval",
          repoRoot: repoDir,
          datasetRoot,
          datasetFile: "longmemeval_oracle.json",
          outputPath,
          artifactsDir,
          embedding: {
            provider: "openai-compatible",
            apiKey: "local-noauth",
            model: "mock-embed-4d",
            baseURL: embeddingServer.baseURL,
            dimensions: 4,
            chunking: true,
          },
          reader: {
            mode: "llm",
            auth: "api-key",
            apiKey: "local-noauth",
            model: "gpt-4o-mini",
            baseURL: llmServer.baseURL,
            timeoutMs: 5_000,
          },
          metricModel: "gpt-4o",
        },
        null,
        2,
      ),
    );

    const { stdout } = await execFileAsync("node", [scriptPath, "--run", configPath], {
      cwd: repoRoot,
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.result.sampleCount, 1);
    assert.equal(parsed.result.overallAccuracy, 1);

    const hypotheses = await readFile(path.join(artifactsDir, "hypotheses.jsonl"), "utf8");
    assert.match(hypotheses, /"hypothesis":"GPS system issue"/);
  } finally {
    await llmServer.close();
    await embeddingServer.close();
  }
});

test("LongMemEval adapter supports an OpenAI-compatible evaluator override", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "longmemeval-openai-compatible-eval-"));
  const datasetRoot = path.join(tempRoot, "dataset");
  const reportsDir = path.join(tempRoot, "reports");
  const artifactsDir = path.join(reportsDir, "artifacts");
  const outputPath = path.join(reportsDir, "summary.json");
  const configPath = path.join(tempRoot, "longmemeval.json");
  const repoDir = await createFakeLongMemEvalRepo(tempRoot);
  const embeddingServer = await startEmbeddingServer();
  const llmServer = await startLlmServer();
  const evaluatorServer = await startEvaluatorServer();

  try {
    await mkdir(datasetRoot, { recursive: true });
    await mkdir(reportsDir, { recursive: true });

    await writeFile(
      path.join(datasetRoot, "longmemeval_oracle.json"),
      JSON.stringify([
        {
          question_id: "q1",
          question_type: "single-session-preference",
          question: "What drink does the user like?",
          answer: "tea",
          question_date: "2025-01-01",
          haystack_session_ids: ["s1"],
          haystack_dates: ["2025-01-01"],
          haystack_sessions: [
            [
              { role: "user", content: "I really like tea." },
              { role: "assistant", content: "Noted, you like tea." },
            ],
          ],
        },
      ], null, 2),
    );

    await writeFile(
      configPath,
      JSON.stringify(
        {
          adapter: "LongMemEval",
          repoRoot: repoDir,
          datasetRoot,
          datasetFile: "longmemeval_oracle.json",
          outputPath,
          artifactsDir,
          embedding: {
            provider: "openai-compatible",
            apiKey: "local-noauth",
            model: "mock-embed-4d",
            baseURL: embeddingServer.baseURL,
            dimensions: 4,
            chunking: true,
          },
          reader: {
            mode: "llm",
            auth: "api-key",
            apiKey: "local-noauth",
            model: "gpt-4o-mini",
            baseURL: llmServer.baseURL,
            timeoutMs: 5_000,
          },
          metricModel: "gpt-4o-mini",
          evaluator: {
            mode: "openai-compatible",
            apiKey: "local-noauth",
            baseURL: evaluatorServer.baseURL,
            model: "openai/gpt-4o-mini",
            timeoutMs: 5_000,
          },
        },
        null,
        2,
      ),
    );

    const { stdout } = await execFileAsync("node", [scriptPath, "--run", configPath], {
      cwd: repoRoot,
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ready, true);
    assert.equal(parsed.result.status, "measured");
    assert.equal(parsed.result.sampleCount, 1);
    assert.equal(parsed.result.overallAccuracy, 1);

    const officialEval = await readFile(path.join(artifactsDir, "hypotheses.jsonl.eval-results-gpt-4o-mini"), "utf8");
    assert.match(officialEval, /"autoeval_label":/);
    assert.equal(evaluatorServer.requests.length > 0, true);
  } finally {
    await evaluatorServer.close();
    await llmServer.close();
    await embeddingServer.close();
  }
});
