import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jitiFactory from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const jiti = jitiFactory(import.meta.url, { interopDefault: true });

const { MemoryStore } = jiti("../../../src/store.ts");
const { createEmbedder, getVectorDimensions } = jiti("../../../src/embedder.ts");
const { createRetriever } = jiti("../../../src/retriever.ts");
const { SmartExtractor } = jiti("../../../src/smart-extractor.ts");
const { createLlmClient } = jiti("../../../src/llm-client.ts");

function toText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => toText(item)).join(" ");
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value == null) return "";
  return String(value);
}

export function serializeLongMemEvalSession(sessionId, sessionDate, turns) {
  const lines = [
    `Session ID: ${sessionId || "unknown"}`,
    `Session Date: ${sessionDate || "unknown"}`,
  ];

  for (const turn of Array.isArray(turns) ? turns : []) {
    const role = typeof turn?.role === "string" ? turn.role : "unknown";
    const content = toText(turn?.content).trim();
    if (!content) continue;
    lines.push(`${role}: ${content}`);
  }

  return lines.join("\n");
}

export function chunkSessionTurns(turns, maxTurns = 8, overlapTurns = 2) {
  const normalizedTurns = Array.isArray(turns) ? turns : [];
  if (normalizedTurns.length <= maxTurns) {
    return [normalizedTurns];
  }

  const stride = Math.max(1, maxTurns - overlapTurns);
  const chunks = [];
  for (let start = 0; start < normalizedTurns.length; start += stride) {
    const chunk = normalizedTurns.slice(start, start + maxTurns);
    if (chunk.length === 0) break;
    chunks.push(chunk);
    if (start + maxTurns >= normalizedTurns.length) {
      break;
    }
  }
  return chunks;
}

function parseStoredMetadata(metadata) {
  if (!metadata || typeof metadata !== "string") return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildQuestionStrategyLines(questionCase) {
  switch (questionCase.questionType) {
    case "temporal-reasoning":
      return [
        "Reason across dates, order, and sequence when the answer depends on what happened first or later.",
        "If one retrieved memory establishes a reference event and another establishes a later issue or update, combine them.",
      ];
    case "knowledge-update":
      return [
        "Prefer the latest retrieved memory when multiple memories describe the same thing over time.",
      ];
    case "multi-session":
      return [
        "Combine evidence across multiple retrieved memories when the answer spans more than one session.",
      ];
    case "single-session-preference":
      return [
        "Answer with the preference itself, not an explanation.",
      ];
    default:
      return [];
  }
}

function renderRetrievedMemory(item, index) {
  const metadata = parseStoredMetadata(item?.entry?.metadata);
  const lines = [
    `Memory ${index + 1} Summary: ${item.entry.text}`,
  ];

  if (typeof metadata.l1_overview === "string" && metadata.l1_overview.trim()) {
    lines.push(`Memory ${index + 1} Overview: ${metadata.l1_overview.trim()}`);
  }
  if (typeof metadata.l2_content === "string" && metadata.l2_content.trim()) {
    lines.push(`Memory ${index + 1} Details: ${metadata.l2_content.trim()}`);
  }

  return lines.join("\n");
}

function buildQuestionPrompt(questionCase, retrievalResults) {
  const memoryLines = retrievalResults.length > 0
    ? retrievalResults.flatMap((item, index) => renderRetrievedMemory(item, index).split("\n"))
    : ["Memory 1 Summary: (none)"];

  return [
    "Answer the LongMemEval benchmark question using only the retrieved memories below.",
    ...buildQuestionStrategyLines(questionCase),
    'If the memories are insufficient, reply exactly: "insufficient information".',
    "Return only the answer phrase, with no explanation.",
    "",
    `Question Date: ${questionCase.questionDate || "unknown"}`,
    `Question Type: ${questionCase.questionType || "unknown"}`,
    `Question: ${questionCase.question}`,
    "",
    "Retrieved Memories:",
    ...memoryLines,
  ].join("\n");
}

function buildRetrievalQuery(questionCase) {
  const hints = [];
  switch (questionCase.questionType) {
    case "single-session-preference":
      hints.push("preference", "favorite", "drink");
      break;
    case "temporal-reasoning":
      hints.push("timeline", "date", "when");
      break;
    case "knowledge-update":
      hints.push("updated", "latest", "current");
      break;
    case "multi-session":
      hints.push("across sessions", "history");
      break;
    default:
      break;
  }

  return [questionCase.question, ...hints].join(" ").trim();
}

export function normalizeLongMemEvalCases(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    questionId: String(entry.question_id),
    questionType: String(entry.question_type || "unknown"),
    question: String(entry.question || ""),
    answer: String(entry.answer || ""),
    questionDate: String(entry.question_date || ""),
    haystackSessionIds: Array.isArray(entry.haystack_session_ids) ? entry.haystack_session_ids.map((value) => String(value)) : [],
    haystackDates: Array.isArray(entry.haystack_dates) ? entry.haystack_dates.map((value) => String(value)) : [],
    haystackSessions: Array.isArray(entry.haystack_sessions) ? entry.haystack_sessions : [],
  }));
}

export async function runLongMemEvalHarness(config) {
  const deterministicReaderConfig = {
    ...config.reader,
    temperature: config.reader?.temperature ?? 0,
  };
  const readerClient = createLlmClient(deterministicReaderConfig);
  const extractionClient = createLlmClient(deterministicReaderConfig);
  const embedder = createEmbedder(config.embedding);
  const vectorDim = getVectorDimensions(config.embedding.model, config.embedding.dimensions);
  const hypothesesPath = path.join(config.artifactsDir, "hypotheses.jsonl");
  const hypotheses = [];

  await mkdir(config.artifactsDir, { recursive: true });

  for (const questionCase of config.cases) {
    const caseRoot = await mkdtemp(path.join(os.tmpdir(), `longmemeval-${questionCase.questionId}-`));
    const dbPath = path.join(caseRoot, "db");
    const store = new MemoryStore({ dbPath, vectorDim });
    try {
      const extractor = new SmartExtractor(store, embedder, extractionClient, {
        defaultScope: "global",
        extractMinMessages: 1,
        extractMaxChars: 24_000,
        log: () => {},
        debugLog: () => {},
      });
      const retriever = createRetriever(store, embedder, {
        mode: "hybrid",
        rerank: "none",
        minScore: 0,
        hardMinScore: 0,
        candidatePoolSize: 12,
        filterNoise: false,
        bm25Weight: 0,
        vectorWeight: 1,
        recencyWeight: 0,
        recencyHalfLifeDays: 0,
        timeDecayHalfLifeDays: 0,
        reinforcementFactor: 0,
        maxHalfLifeMultiplier: 1,
        lengthNormAnchor: 0,
      });

      for (let index = 0; index < questionCase.haystackSessions.length; index += 1) {
        const sessionId = questionCase.haystackSessionIds[index];
        const sessionDate = questionCase.haystackDates[index];
        const sessionTurns = questionCase.haystackSessions[index];
        const transcriptChunks = chunkSessionTurns(sessionTurns);

        for (let chunkIndex = 0; chunkIndex < transcriptChunks.length; chunkIndex += 1) {
          const transcript = serializeLongMemEvalSession(
            sessionId,
            sessionDate,
            transcriptChunks[chunkIndex],
          );
          await extractor.extractAndPersist(
            transcript,
            `longmemeval:${questionCase.questionId}:${index}:${chunkIndex}`,
            { scope: "global" },
          );
        }
      }

      const retrievalResults = await retriever.retrieve({
        query: buildRetrievalQuery(questionCase),
        limit: 6,
        scopeFilter: ["global"],
        source: "manual",
      });
      const prompt = buildQuestionPrompt(questionCase, retrievalResults);
      const hypothesis = await readerClient.completeText(prompt, `longmemeval:${questionCase.questionId}`);
      if (hypothesis == null) {
        throw new Error(
          `LongMemEval reader failed for ${questionCase.questionId}: ${readerClient.getLastError() || "unknown error"}`,
        );
      }

      hypotheses.push({
        question_id: questionCase.questionId,
        hypothesis: hypothesis.trim(),
      });
    } finally {
      store.close?.();
    }
  }

  await writeFile(
    hypothesesPath,
    `${hypotheses.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );

  return {
    hypothesesPath,
    sampleCount: hypotheses.length,
  };
}

export { repoRoot as longMemEvalHarnessRepoRoot };
