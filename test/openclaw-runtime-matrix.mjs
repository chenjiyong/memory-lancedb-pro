import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { tmpdir } from "node:os";

function toVector(text) {
  const s = String(text || "").toLowerCase();
  return [
    s.includes("resume") || s.includes("rehydrate") ? 1 : 0,
    s.includes("legacy") ? 1 : 0,
    s.includes("global") ? 1 : 0,
    Math.min(1, s.length / 1000),
  ];
}

function createEmbeddingResponse(input, model) {
  const values = Array.isArray(input) ? input : [input];
  return {
    object: "list",
    data: values.map((value, index) => ({
      object: "embedding",
      index,
      embedding: toVector(value),
    })),
    model,
    usage: {
      prompt_tokens: values.length,
      total_tokens: values.length,
    },
  };
}

async function startMockEmbeddingServer() {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/embeddings") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const payload = createEmbeddingResponse(body.input, body.model || "mock-embed-4d");

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert(address && typeof address === "object");

  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function stripPluginLogs(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("[plugins]"))
    .join("\n")
    .trim();
}

function parseJsonOutput(output) {
  return JSON.parse(stripPluginLogs(output));
}

function runOpenClaw(profile, args, repoRoot, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "openclaw",
      ["--profile", profile, "--no-color", ...args],
      {
        cwd: repoRoot,
        env: { ...process.env, ...(options.env || {}) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = options.timeoutMs ?? 120_000;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`openclaw ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
      if ((code ?? 1) !== 0) {
        reject(new Error(`openclaw ${args.join(" ")} failed with code ${code ?? "unknown"}\n${combined}`));
        return;
      }
      resolve(combined);
    });
  });
}

async function main() {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const runDir = mkdtempSync(path.join(tmpdir(), "memory-lancedb-pro-runtime-matrix-"));
  const profile = `mempro-runtime-${Date.now()}`;
  const profileDir = path.join(os.homedir(), `.openclaw-${profile}`);
  const configFile = path.join(profileDir, "openclaw.json");
  const workspaceDir = path.join(runDir, "workspace");
  const importFile = path.join(runDir, "import.json");
  const legacyImportFile = path.join(runDir, "legacy-import.json");
  let server;

  try {
    server = await startMockEmbeddingServer();

    rmSync(profileDir, { recursive: true, force: true });
    mkdirSync(profileDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });

    const config = {
      agents: {
        defaults: {
          workspace: workspaceDir,
        },
      },
      plugins: {
        allow: ["memory-lancedb-pro"],
        load: {
          paths: [repoRoot],
        },
        slots: {
          memory: "memory-lancedb-pro",
        },
        entries: {
          "memory-lancedb-pro": {
            enabled: true,
            config: {
              embedding: {
                provider: "openai-compatible",
                apiKey: "local-noauth",
                model: "mock-embed-4d",
                baseURL: server.baseURL,
                dimensions: 4,
                chunking: true,
              },
              dbPath: path.join(runDir, "db"),
              sessionStrategy: "none",
              autoCapture: false,
              autoRecall: false,
              captureAssistant: false,
              smartExtraction: false,
              retrieval: {
                mode: "vector",
                rerank: "none",
                minScore: 0,
                hardMinScore: 0,
              },
              sessionMemory: {
                enabled: false,
              },
            },
          },
        },
      },
    };

    writeFileSync(configFile, JSON.stringify(config, null, 2));

    await runOpenClaw(profile, ["config", "validate"], repoRoot);
    await runOpenClaw(profile, ["plugins", "info", "memory-lancedb-pro"], repoRoot);

    const freshDoctor = parseJsonOutput(await runOpenClaw(profile, ["memory-pro", "doctor", "--json"], repoRoot));
    assert.equal(freshDoctor.rehydrate.kind, "fresh-install");
    assert.equal(freshDoctor.rehydrate.state, "fresh-install");

    mkdirSync(path.join(workspaceDir, "sessions"), { recursive: true });
    writeFileSync(
      path.join(workspaceDir, "sessions", "resume.jsonl"),
      `${JSON.stringify({ type: "message", message: { role: "user", content: "resume the previous task" } })}\n`,
    );
    const workspaceDoctor = parseJsonOutput(await runOpenClaw(profile, ["memory-pro", "doctor", "--json"], repoRoot));
    assert.equal(workspaceDoctor.rehydrate.kind, "workspace-rehydrate");
    assert.equal(workspaceDoctor.rehydrate.state, "workspace-rehydrate");

    rmSync(workspaceDir, { recursive: true, force: true });
    mkdirSync(workspaceDir, { recursive: true });

    writeFileSync(importFile, JSON.stringify({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      count: 1,
      filters: {},
      memories: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          text: "resume-ready memory in the global scope",
          category: "fact",
          scope: "global",
          importance: 0.7,
          timestamp: 1772931900000,
          metadata: JSON.stringify({
            source: "manual",
            state: "confirmed",
            memory_layer: "durable",
            l0_abstract: "resume-ready memory in the global scope",
            l1_overview: "- resume-ready memory in the global scope",
            l2_content: "resume-ready memory in the global scope",
            memory_category: "fact",
          }),
        },
      ],
    }, null, 2));
    await runOpenClaw(profile, ["memory-pro", "import", importFile, "--scope", "global"], repoRoot);

    const resumeDoctor = parseJsonOutput(await runOpenClaw(profile, ["memory-pro", "doctor", "--json"], repoRoot));
    assert.equal(resumeDoctor.rehydrate.kind, "resume-existing");
    assert.equal(resumeDoctor.rehydrate.state, "resume-ready");

    mkdirSync(path.join(workspaceDir, "memory"), { recursive: true });
    writeFileSync(path.join(workspaceDir, "memory", "stale.md"), "stale artifact");
    const staleDoctor = parseJsonOutput(await runOpenClaw(profile, ["memory-pro", "doctor", "--json"], repoRoot));
    assert.equal(staleDoctor.rehydrate.kind, "resume-existing");
    assert.equal(staleDoctor.rehydrate.state, "stale-artifacts");

    rmSync(workspaceDir, { recursive: true, force: true });
    mkdirSync(workspaceDir, { recursive: true });

    writeFileSync(legacyImportFile, JSON.stringify({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      count: 1,
      filters: {},
      memories: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          text: "legacy-tagged memory that should require migration",
          category: "fact",
          scope: "global",
          importance: 0.6,
          timestamp: 1772931960000,
          metadata: "{\"source\":\"legacy\"}",
        },
      ],
    }, null, 2));
    await runOpenClaw(profile, ["memory-pro", "import", legacyImportFile, "--scope", "global"], repoRoot);

    const legacyDoctor = parseJsonOutput(await runOpenClaw(profile, ["memory-pro", "doctor", "--json"], repoRoot));
    assert.equal(legacyDoctor.rehydrate.kind, "upgrade-required");
    assert.equal(legacyDoctor.rehydrate.state, "migrate-pending");
    assert.equal(legacyDoctor.memory.hasLegacyArtifacts, true);

    console.log("OK: openclaw runtime matrix test passed");
  } finally {
    if (server) {
      await server.close();
    }
    rmSync(profileDir, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
