import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jitiFactory from "jiti";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pluginSdkStubPath = path.resolve(testDir, "helpers", "openclaw-plugin-sdk-stub.mjs");
const jiti = jitiFactory(import.meta.url, {
  interopDefault: true,
  alias: {
    "openclaw/plugin-sdk": pluginSdkStubPath,
  },
});

const pluginModule = jiti("../index.ts");
const memoryLanceDBProPlugin = pluginModule.default || pluginModule;
const { Embedder } = jiti("../src/embedder.ts");

function createPluginApiHarness({ pluginConfig, resolveRoot }) {
  const services = [];

  const api = {
    pluginConfig,
    resolvePath(target) {
      if (typeof target !== "string") return target;
      if (path.isAbsolute(target)) return target;
      return path.join(resolveRoot, target);
    },
    logger: {
      info() {},
      warn() {},
      debug() {},
      error() {},
    },
    registerTool() {},
    registerCli() {},
    registerService(service) {
      services.push(service);
    },
    on() {},
    registerHook() {},
  };

  return { api, services };
}

describe("service startup timers", () => {
  it("skips noise-bank warmup during one-shot CLI registration", () => {
    const workDir = mkdtempSync(path.join(tmpdir(), "service-startup-timers-"));
    const originalArgv = process.argv;
    const originalEmbed = Embedder.prototype.embed;
    let embedCalls = 0;
    try {
      process.argv = ["node", "openclaw", "plugins", "info", "memory-lancedb-pro"];
      Embedder.prototype.embed = async function patchedEmbed(text) {
        embedCalls += 1;
        return [0, 0, 0, 0];
      };

      const harness = createPluginApiHarness({
        resolveRoot: workDir,
        pluginConfig: {
          dbPath: path.join(workDir, "db"),
          embedding: { apiKey: "test-api-key" },
          smartExtraction: true,
          autoCapture: true,
          autoRecall: true,
          selfImprovement: { enabled: false, beforeResetNote: false, ensureLearningFiles: false },
        },
      });

      memoryLanceDBProPlugin.register(harness.api);
      assert.equal(embedCalls, 0, "one-shot CLI registration should not warm the noise bank");
    } finally {
      process.argv = originalArgv;
      Embedder.prototype.embed = originalEmbed;
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("warms the noise bank during gateway registration", () => {
    const workDir = mkdtempSync(path.join(tmpdir(), "service-startup-timers-"));
    const originalArgv = process.argv;
    const originalEmbed = Embedder.prototype.embed;
    let embedCalls = 0;
    try {
      process.argv = ["node", "openclaw", "gateway", "--port", "18789"];
      Embedder.prototype.embed = async function patchedEmbed(text) {
        embedCalls += 1;
        return [0, 0, 0, 0];
      };

      const harness = createPluginApiHarness({
        resolveRoot: workDir,
        pluginConfig: {
          dbPath: path.join(workDir, "db"),
          embedding: { apiKey: "test-api-key" },
          smartExtraction: true,
          autoCapture: true,
          autoRecall: true,
          selfImprovement: { enabled: false, beforeResetNote: false, ensureLearningFiles: false },
        },
      });

      memoryLanceDBProPlugin.register(harness.api);
      assert.ok(embedCalls >= 1, "gateway registration should warm the noise bank");
    } finally {
      process.argv = originalArgv;
      Embedder.prototype.embed = originalEmbed;
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("skips gateway-only background work for one-shot CLI commands", async () => {
    const workDir = mkdtempSync(path.join(tmpdir(), "service-startup-timers-"));
    const originalArgv = process.argv;
    try {
      const harness = createPluginApiHarness({
        resolveRoot: workDir,
        pluginConfig: {
          dbPath: path.join(workDir, "db"),
          embedding: { apiKey: "test-api-key" },
          smartExtraction: false,
          autoCapture: true,
          autoRecall: true,
          selfImprovement: { enabled: false, beforeResetNote: false, ensureLearningFiles: false },
        },
      });

      memoryLanceDBProPlugin.register(harness.api);
      assert.equal(harness.services.length, 1);
      const [service] = harness.services;
      assert.equal(typeof service.start, "function");

      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      const handles = [];

      global.setTimeout = (fn, delay, ...args) => {
        const handle = {
          kind: "timeout",
          delay,
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
            return this;
          },
        };
        handles.push(handle);
        return handle;
      };

      global.setInterval = (fn, delay, ...args) => {
        const handle = {
          kind: "interval",
          delay,
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
            return this;
          },
        };
        handles.push(handle);
        return handle;
      };

      process.argv = ["node", "openclaw", "plugins", "info", "memory-lancedb-pro"];

      try {
        await service.start();
      } finally {
        process.argv = originalArgv;
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
      }

      assert.equal(handles.length, 0, "one-shot CLI commands should not schedule background startup timers");
    } finally {
      process.argv = originalArgv;
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("unrefs background timers for gateway-style startup", async () => {
    const workDir = mkdtempSync(path.join(tmpdir(), "service-startup-timers-"));
    const originalArgv = process.argv;
    try {
      const harness = createPluginApiHarness({
        resolveRoot: workDir,
        pluginConfig: {
          dbPath: path.join(workDir, "db"),
          embedding: { apiKey: "test-api-key" },
          smartExtraction: false,
          autoCapture: true,
          autoRecall: true,
          selfImprovement: { enabled: false, beforeResetNote: false, ensureLearningFiles: false },
        },
      });

      memoryLanceDBProPlugin.register(harness.api);
      assert.equal(harness.services.length, 1);
      const [service] = harness.services;
      assert.equal(typeof service.start, "function");

      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      const handles = [];

      global.setTimeout = (fn, delay, ...args) => {
        const handle = {
          kind: "timeout",
          delay,
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
            return this;
          },
        };
        handles.push(handle);
        return handle;
      };

      global.setInterval = (fn, delay, ...args) => {
        const handle = {
          kind: "interval",
          delay,
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
            return this;
          },
        };
        handles.push(handle);
        return handle;
      };

      process.argv = ["node", "openclaw", "gateway", "--port", "18789"];

      try {
        await service.start();
      } finally {
        process.argv = originalArgv;
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
      }

      const longLivedHandles = handles.filter((handle) => handle.delay === 5_000 || handle.delay === 60_000 || handle.kind === "interval");
      assert.ok(longLivedHandles.length >= 3, "expected startup to schedule deferred health/backup timers");
      assert.ok(longLivedHandles.every((handle) => handle.unrefCalled), "background timers should be unrefed");
    } finally {
      process.argv = originalArgv;
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
