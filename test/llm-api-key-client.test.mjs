import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { createLlmClient } = jiti("../src/llm-client.ts");

describe("LLM api-key client", () => {
  let server;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    delete process.env.TEST_LLM_API_KEY;
  });

  it("uses chat.completions.create semantics with the provided api-key configuration", async () => {
    let requestHeaders;
    let requestBody;

    server = http.createServer(async (req, res) => {
      requestHeaders = req.headers;

      let body = "";
      for await (const chunk of req) body += chunk;
      requestBody = JSON.parse(body);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: "{\"memories\":[]}",
            },
          },
        ],
      }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const llm = createLlmClient({
      auth: "api-key",
      apiKey: "test-api-key",
      model: "gpt-4o-mini",
      baseURL: `http://127.0.0.1:${port}/v1`,
      timeoutMs: 4321,
    });

    const result = await llm.completeJson("hello", "api-key-probe");
    assert.deepEqual(result, { memories: [] });
    assert.equal(requestHeaders.authorization, "Bearer test-api-key");
    assert.equal(requestBody.model, "gpt-4o-mini");
    assert.deepEqual(requestBody.messages, [
      {
        role: "system",
        content: "You are a memory extraction assistant. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: "hello",
      },
    ]);
    assert.equal(requestBody.temperature, 0.1);
  });

  it("honors an explicit api-key temperature override", async () => {
    let requestBody;

    server = http.createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      requestBody = JSON.parse(body);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: "deterministic",
            },
          },
        ],
      }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const llm = createLlmClient({
      auth: "api-key",
      apiKey: "test-api-key",
      model: "gpt-4o-mini",
      baseURL: `http://127.0.0.1:${port}/v1`,
      timeoutMs: 4321,
      temperature: 0,
    });

    const result = await llm.completeText("be deterministic", "temperature-override");
    assert.equal(result, "deterministic");
    assert.equal(requestBody.temperature, 0);
  });

  it("returns plain text for benchmark-style prompts", async () => {
    server = http.createServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: "tea",
            },
          },
        ],
      }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const llm = createLlmClient({
      auth: "api-key",
      apiKey: "test-api-key",
      model: "gpt-4o-mini",
      baseURL: `http://127.0.0.1:${port}/v1`,
      timeoutMs: 4321,
    });

    const result = await llm.completeText("what is the answer?", "benchmark-reader");
    assert.equal(result, "tea");
  });

  it("resolves api-key environment placeholders before issuing requests", async () => {
    let requestHeaders;

    server = http.createServer(async (req, res) => {
      requestHeaders = req.headers;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: "resolved",
            },
          },
        ],
      }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.TEST_LLM_API_KEY = "resolved-api-key";

    const llm = createLlmClient({
      auth: "api-key",
      apiKey: "${TEST_LLM_API_KEY}",
      model: "gpt-4o-mini",
      baseURL: `http://127.0.0.1:${port}/v1`,
      timeoutMs: 4321,
    });

    const result = await llm.completeText("hello", "env-placeholder");
    assert.equal(result, "resolved");
    assert.equal(requestHeaders.authorization, "Bearer resolved-api-key");
  });
});
