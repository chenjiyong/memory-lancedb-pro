import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { buildRuntimeHealthReport } = jiti("../src/runtime-health.ts");
const { classifyRehydrateDecision } = jiti("../src/runtime-rehydrate.ts");
const { buildRuntimeInspectionReport } = jiti("../src/runtime-inspection.ts");

function buildHealthyReport() {
  return buildRuntimeHealthReport({
    pluginId: "memory-lancedb-pro",
    pluginRoot: "/repo/memory-lancedb-pro",
    dbPath: "/tmp/db",
    workspaceDir: "/tmp/workspace",
    openclawVersion: "2026.3.23",
    pluginSlot: "memory-lancedb-pro",
    allowlist: ["memory-lancedb-pro"],
    loadPaths: ["/repo/memory-lancedb-pro"],
    requiredHooks: ["before_prompt_build"],
    registeredHooks: ["before_prompt_build"],
  });
}

describe("runtime rehydrate decision", () => {
  it("marks blocked runtime as runtime-blocked instead of conflating it with migration", () => {
    const health = buildRuntimeHealthReport({
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

    const decision = classifyRehydrateDecision({
      health,
      memoryCount: 3,
      reflectionArtifactCount: 0,
      workspaceArtifactCount: 0,
      hasLegacyArtifacts: false,
    });

    assert.equal(decision.kind, "upgrade-required");
    assert.equal(decision.state, "runtime-blocked");
    assert.equal(decision.safeToAutoRehydrate, false);
  });

  it("classifies legacy data as migrate-pending while keeping the upgrade-required summary", () => {
    const decision = classifyRehydrateDecision({
      health: buildHealthyReport(),
      memoryCount: 2,
      reflectionArtifactCount: 0,
      workspaceArtifactCount: 0,
      hasLegacyArtifacts: true,
    });

    assert.equal(decision.kind, "upgrade-required");
    assert.equal(decision.state, "migrate-pending");
    assert.match(decision.reason, /migration/i);
  });

  it("marks resume-existing sessions with extra reflection/workspace artifacts as stale-artifacts", () => {
    const decision = classifyRehydrateDecision({
      health: buildHealthyReport(),
      memoryCount: 2,
      reflectionArtifactCount: 4,
      workspaceArtifactCount: 3,
      hasLegacyArtifacts: false,
    });

    assert.equal(decision.kind, "resume-existing");
    assert.equal(decision.state, "stale-artifacts");
    assert.equal(decision.safeToAutoRehydrate, true);
  });
});

describe("runtime inspection report", () => {
  it("uses explicit memory counts instead of collapsing db artifacts into a boolean", () => {
    const report = buildRuntimeInspectionReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.23",
      pluginSlot: "memory-lancedb-pro",
      allowlist: ["memory-lancedb-pro"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: ["before_prompt_build"],
      registeredHooks: ["before_prompt_build"],
      memoryCount: 7,
      dbArtifactCount: 11,
      reflectionArtifactCount: 2,
      workspaceArtifactCount: 3,
      hasLegacyArtifacts: false,
    });

    assert.equal(report.observed.memoryCount, 7);
    assert.equal(report.observed.dbArtifactCount, 11);
    assert.equal(report.rehydrate.kind, "resume-existing");
    assert.equal(report.rehydrate.state, "stale-artifacts");
  });

  it("falls back to db artifact presence only when an explicit memory count is unavailable", () => {
    const report = buildRuntimeInspectionReport({
      pluginId: "memory-lancedb-pro",
      pluginRoot: "/repo/memory-lancedb-pro",
      dbPath: "/tmp/db",
      workspaceDir: "/tmp/workspace",
      openclawVersion: "2026.3.23",
      pluginSlot: "memory-lancedb-pro",
      allowlist: ["memory-lancedb-pro"],
      loadPaths: ["/repo/memory-lancedb-pro"],
      requiredHooks: ["before_prompt_build"],
      registeredHooks: [],
      dbArtifactCount: 2,
      reflectionArtifactCount: 0,
      workspaceArtifactCount: 0,
      hasLegacyArtifacts: false,
    });

    assert.equal(report.observed.memoryCount, 1);
    assert.equal(report.rehydrate.kind, "resume-existing");
    assert.equal(report.rehydrate.state, "resume-ready");
  });
});
