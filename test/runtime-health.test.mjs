import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  buildRuntimeHealthReport,
} = jiti("../src/runtime-health.ts");
const {
  classifyRehydrateDecision,
} = jiti("../src/runtime-rehydrate.ts");

describe("runtime health report", () => {
  it("reports healthy when plugin slot, allowlist, load path, and hooks are ready", () => {
    const report = buildRuntimeHealthReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.23",
      pluginSlot: "memory-lancedb-pro",
      allowlist: ["memory-lancedb-pro"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: ["before_prompt_build", "agent_end", "command:new", "command:reset"],
      registeredHooks: ["before_prompt_build", "agent_end", "command:new", "command:reset"],
    });

    assert.equal(report.mode, "healthy");
    assert.equal(report.status, "pass");
    assert.equal(report.checks.filter((check) => check.status !== "pass").length, 0);
  });

  it("blocks when slot and allowlist do not point at this plugin", () => {
    const report = buildRuntimeHealthReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.21",
      pluginSlot: "some-other-plugin",
      allowlist: ["some-other-plugin"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: ["before_prompt_build"],
      registeredHooks: ["before_prompt_build"],
    });

    assert.equal(report.mode, "blocked");
    assert.equal(report.status, "fail");
    assert.equal(report.checks.find((check) => check.key === "slot")?.status, "fail");
    assert.equal(report.checks.find((check) => check.key === "allowlist")?.status, "fail");
    assert.equal(report.checks.find((check) => check.key === "openclawVersion")?.status, "warn");
  });
});

describe("rehydrate decision", () => {
  it("classifies fresh install when health is good and no prior artifacts exist", () => {
    const health = buildRuntimeHealthReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.23",
      pluginSlot: "memory-lancedb-pro",
      allowlist: ["memory-lancedb-pro"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: [],
      registeredHooks: [],
    });

    const decision = classifyRehydrateDecision({
      health,
      memoryCount: 0,
      reflectionArtifactCount: 0,
      workspaceArtifactCount: 0,
      hasLegacyArtifacts: false,
    });

    assert.equal(decision.kind, "fresh-install");
    assert.equal(decision.safeToAutoRehydrate, false);
  });

  it("classifies workspace rehydrate when db is empty but workspace artifacts already exist", () => {
    const health = buildRuntimeHealthReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.23",
      pluginSlot: "memory-lancedb-pro",
      allowlist: ["memory-lancedb-pro"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: [],
      registeredHooks: [],
    });

    const decision = classifyRehydrateDecision({
      health,
      memoryCount: 0,
      reflectionArtifactCount: 2,
      workspaceArtifactCount: 4,
      hasLegacyArtifacts: false,
    });

    assert.equal(decision.kind, "workspace-rehydrate");
    assert.equal(decision.safeToAutoRehydrate, true);
  });
});
