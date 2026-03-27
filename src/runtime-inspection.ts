import {
  buildRuntimeHealthReport,
  type RuntimeHealthReport,
  type RuntimeHealthReportParams,
} from "./runtime-health.js";
import {
  classifyRehydrateDecision,
  type RehydrateDecision,
} from "./runtime-rehydrate.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface RuntimeInspectionReport {
  health: RuntimeHealthReport;
  rehydrate: RehydrateDecision;
  observed: {
    memoryCount: number;
    dbArtifactCount: number;
    reflectionArtifactCount: number;
    workspaceArtifactCount: number;
    hasLegacyArtifacts: boolean;
  };
}

export interface RuntimeInspectionReportParams extends RuntimeHealthReportParams {
  memoryCount?: number;
  dbArtifactCount?: number;
  reflectionArtifactCount?: number;
  workspaceArtifactCount?: number;
  hasLegacyArtifacts?: boolean;
}

export function inferExpectedRuntimeHooks(config: Record<string, any> = {}, recallMode?: string): string[] {
  const startupRecallMode = recallMode || config.recallMode || "full";
  return Array.from(new Set([
    config.autoRecall === true && startupRecallMode !== "off" ? "before_prompt_build" : null,
    config.autoCapture !== false ? "agent_end" : null,
    config.selfImprovement?.enabled !== false ? "agent:bootstrap" : null,
    config.selfImprovement?.enabled !== false && config.selfImprovement?.beforeResetNote !== false ? "command:new" : null,
    config.selfImprovement?.enabled !== false && config.selfImprovement?.beforeResetNote !== false ? "command:reset" : null,
    config.sessionStrategy === "memoryReflection" ? "after_tool_call" : null,
    config.sessionStrategy === "memoryReflection" ? "session_end" : null,
    config.sessionStrategy === "memoryReflection" ? "before_prompt_build" : null,
    config.sessionStrategy === "memoryReflection" ? "command:new" : null,
    config.sessionStrategy === "memoryReflection" ? "command:reset" : null,
    config.sessionStrategy === "systemSessionMemory" ? "command:new" : null,
  ].filter((value): value is string => Boolean(value))));
}

function normalizeCount(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

export async function countDirectoryArtifacts(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.length;
  } catch {
    return 0;
  }
}

export async function countWorkspaceArtifacts(workspaceDir: string): Promise<number> {
  const [memoryArtifacts, sessionArtifacts] = await Promise.all([
    countDirectoryArtifacts(join(workspaceDir, "memory")),
    countDirectoryArtifacts(join(workspaceDir, "sessions")),
  ]);
  return memoryArtifacts + sessionArtifacts;
}

export function buildRuntimeInspectionReport(
  params: RuntimeInspectionReportParams,
): RuntimeInspectionReport {
  const health = buildRuntimeHealthReport(params);
  const dbArtifactCount = normalizeCount(params.dbArtifactCount);
  const memoryCount = typeof params.memoryCount === "number"
    ? normalizeCount(params.memoryCount)
    : dbArtifactCount > 0 ? 1 : 0;
  const reflectionArtifactCount = normalizeCount(params.reflectionArtifactCount);
  const workspaceArtifactCount = normalizeCount(params.workspaceArtifactCount);
  const hasLegacyArtifacts = Boolean(params.hasLegacyArtifacts);
  const rehydrate = classifyRehydrateDecision({
    health,
    memoryCount,
    reflectionArtifactCount,
    workspaceArtifactCount,
    hasLegacyArtifacts,
  });

  return {
    health,
    rehydrate,
    observed: {
      memoryCount,
      dbArtifactCount,
      reflectionArtifactCount,
      workspaceArtifactCount,
      hasLegacyArtifacts,
    },
  };
}
