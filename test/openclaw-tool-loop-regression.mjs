import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import Module from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import jitiFactory from "jiti";

process.env.NODE_PATH = [
  process.env.NODE_PATH,
  "/opt/homebrew/lib/node_modules/openclaw/node_modules",
  "/opt/homebrew/lib/node_modules",
].filter(Boolean).join(":");
Module._initPaths();

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const plugin = jiti("../index.ts");

function toVector(text) {
  const s = String(text || "").toLowerCase();
  return [
    s.includes("main-private") ? 1 : 0,
    s.includes("work-private") ? 1 : 0,
    s.includes("global-shared") ? 1 : 0,
    Math.min(1, s.length / 1000),
  ];
}

function createMockApi(pluginConfig, options = {}) {
  return {
    pluginConfig,
    hooks: {},
    toolFactories: {},
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
    resolvePath(value) {
      return value;
    },
    registerTool(toolOrFactory, meta) {
      const name =
        typeof meta?.name === "string" && meta.name.length > 0
          ? meta.name
          : typeof toolOrFactory?.name === "string" && toolOrFactory.name.length > 0
            ? toolOrFactory.name
            : undefined;
      if (!name) return;
      this.toolFactories[name] =
        typeof toolOrFactory === "function" ? toolOrFactory : () => toolOrFactory;
    },
    registerCli() {},
    registerService(service) {
      options.services?.push(service);
    },
    on(name, handler) {
      this.hooks[name] = handler;
    },
    registerHook(name, handler) {
      this.hooks[name] = handler;
    },
  };
}

async function startEmbeddingServer() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/embeddings") {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push(payload);
    const inputs = Array.isArray(payload.input) ? payload.input : [payload.input];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      object: "list",
      data: inputs.map((input, index) => ({
        object: "embedding",
        index,
        embedding: toVector(input),
      })),
      model: payload.model || "mock-embedding-model",
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    baseURL: `http://127.0.0.1:${port}/v1`,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function main() {
  const workDir = mkdtempSync(path.join(tmpdir(), "memory-tool-loop-regression-"));
  const services = [];
  const embeddingServer = await startEmbeddingServer();

  try {
    const api = createMockApi(
      {
        dbPath: path.join(workDir, "db"),
        enableManagementTools: true,
        autoCapture: false,
        autoRecall: false,
        sessionMemory: { enabled: true, messageCount: 6 },
        scopes: {
          default: "main",
          definitions: {
            global: { description: "shared scope" },
            main: { description: "main agent scope" },
            work: { description: "work agent scope" },
            life: { description: "life agent scope" },
          },
          agentAccess: {
            main: ["global", "main"],
            work: ["global", "work"],
            life: ["life"],
          },
        },
        embedding: {
          provider: "openai-compatible",
          apiKey: "dummy",
          model: "mock-embed-4d",
          baseURL: embeddingServer.baseURL,
          dimensions: 4,
          chunking: true,
        },
      },
      { services },
    );
    plugin.register(api);

    const mainCtx = { agentId: "main", sessionKey: "agent:main:test" };
    const workCtx = { agentId: "work", sessionKey: "agent:work:test" };
    const lifeCtx = { agentId: "life", sessionKey: "agent:life:test" };

    const mainStore = api.toolFactories.memory_store(mainCtx);
    const mainRecall = api.toolFactories.memory_recall(mainCtx);
    const mainUpdate = api.toolFactories.memory_update(mainCtx);
    const mainForget = api.toolFactories.memory_forget(mainCtx);
    const mainStats = api.toolFactories.memory_stats(mainCtx);
    const mainList = api.toolFactories.memory_list(mainCtx);
    const workStore = api.toolFactories.memory_store(workCtx);
    const workRecall = api.toolFactories.memory_recall(workCtx);
    const lifeRecall = api.toolFactories.memory_recall(lifeCtx);

    const mainStoreResult = await mainStore.execute("tool-main-store", {
      text: "main-private roadmap alpha",
      category: "decision",
    });
    assert.equal(mainStoreResult.details.action, "created");
    const mainMemoryId = mainStoreResult.details.id;

    const globalStoreResult = await mainStore.execute("tool-global-store", {
      text: "global-shared tea preference",
      category: "preference",
      scope: "global",
    });
    assert.equal(globalStoreResult.details.scope, "global");

    const workStoreResult = await workStore.execute("tool-work-store", {
      text: "work-private roadmap only",
      category: "fact",
      scope: "work",
    });
    assert.equal(workStoreResult.details.action, "created");

    const mainListResult = await mainList.execute("tool-main-list", {
      scope: "main",
      limit: 10,
    });
    assert.equal(mainListResult.details.count, 1);
    assert.equal(mainListResult.details.memories[0].id, mainMemoryId);

    const mainStatsResult = await mainStats.execute("tool-main-stats", {
      scope: "main",
    });
    assert.equal(mainStatsResult.details.stats.totalCount, 1);

    const mainRecallResult = await mainRecall.execute("tool-main-recall", {
      query: "main-private roadmap alpha",
      scope: "main",
      includeFullText: true,
    });
    assert.equal(mainRecallResult.details.count, 1);
    assert.equal(mainRecallResult.details.memories[0].id, mainMemoryId);

    const updatedResult = await mainUpdate.execute("tool-main-update", {
      memoryId: mainMemoryId,
      text: "main-private roadmap beta",
    });
    assert.equal(updatedResult.details.action, "updated");

    const updatedRecall = await mainRecall.execute("tool-main-recall-updated", {
      query: "main-private roadmap beta",
      scope: "main",
      includeFullText: true,
    });
    assert.equal(updatedRecall.details.count, 1);
    assert.match(updatedRecall.content[0].text, /beta/);

    const hiddenWorkRecall = await mainRecall.execute("tool-main-hidden-work", {
      query: "work-private roadmap only",
      includeFullText: true,
    });
    assert.ok(
      hiddenWorkRecall.details.memories.every((memory) => memory.scope !== "work"),
      "main agent should not receive work-scope memories",
    );

    const workGlobalRecall = await workRecall.execute("tool-work-global", {
      query: "global-shared tea preference",
      includeFullText: true,
    });
    assert.ok(
      workGlobalRecall.details.memories.some((memory) => memory.scope === "global" && /global-shared tea preference/.test(memory.text)),
      "work agent should still recall global memories",
    );

    const lifeWorkRecall = await lifeRecall.execute("tool-life-work", {
      query: "work-private roadmap only",
      includeFullText: true,
    });
    assert.equal(lifeWorkRecall.details.count, 0);

    const forgetResult = await mainForget.execute("tool-main-forget", {
      memoryId: mainMemoryId,
    });
    assert.equal(forgetResult.details.action, "deleted");

    const mainListAfterForget = await mainList.execute("tool-main-list-after-forget", {
      scope: "main",
      limit: 10,
    });
    assert.equal(mainListAfterForget.details.count, 0);

    const sessionApi = createMockApi(
      {
        dbPath: path.join(workDir, "db-session"),
        enableManagementTools: true,
        autoCapture: false,
        autoRecall: false,
        sessionMemory: { enabled: true, messageCount: 6 },
        embedding: {
          provider: "openai-compatible",
          apiKey: "dummy",
          model: "mock-embed-4d",
          baseURL: embeddingServer.baseURL,
          dimensions: 4,
          chunking: true,
        },
      },
      { services: [] },
    );
    plugin.register(sessionApi);
    assert.equal(typeof sessionApi.hooks["command:new"], "function");

    const sessionFile = path.join(workDir, "session.jsonl");
    writeFileSync(
      sessionFile,
      [
        { type: "message", message: { role: "user", content: "Summarize the previous session." } },
        { type: "message", message: { role: "assistant", content: "We validated the continuity and scope matrix." } },
      ].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    );

    await sessionApi.hooks["command:new"]({
      agentId: "main",
      sessionKey: "agent:main:test",
      timestamp: Date.UTC(2026, 2, 27, 21, 0, 0),
      context: {
        agentId: "main",
        commandSource: "test",
        previousSessionEntry: {
          sessionId: "sess-prev-1",
          sessionFile,
        },
      },
    });

    const sessionList = await sessionApi.toolFactories.memory_list(mainCtx).execute("tool-session-list", {
      limit: 10,
    });
    assert.equal(sessionList.details.count, 1);
    assert.match(sessionList.details.memories[0].text, /Conversation Summary:/);
    assert.match(sessionList.details.memories[0].text, /sess-prev-1/);

    console.log("OK: openclaw tool loop regression test passed");
  } finally {
    await embeddingServer.close();
    await Promise.allSettled(services.map((service) => service.stop?.()));
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
