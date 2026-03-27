import type { RuntimeHealthReport } from "./runtime-health.js";

export interface RehydrateDecision {
  kind: "fresh-install" | "workspace-rehydrate" | "resume-existing" | "upgrade-required";
  reason: string;
  safeToAutoRehydrate: boolean;
}

export interface RehydrateDecisionParams {
  health: RuntimeHealthReport;
  memoryCount: number;
  reflectionArtifactCount: number;
  workspaceArtifactCount: number;
  hasLegacyArtifacts: boolean;
}

export function classifyRehydrateDecision(params: RehydrateDecisionParams): RehydrateDecision {
  if (params.health.mode === "blocked") {
    return {
      kind: "upgrade-required",
      reason: "Runtime health checks are blocked.",
      safeToAutoRehydrate: false,
    };
  }

  if (params.memoryCount === 0 && params.workspaceArtifactCount === 0 && params.reflectionArtifactCount === 0) {
    return {
      kind: "fresh-install",
      reason: "No prior memories or workspace artifacts were found.",
      safeToAutoRehydrate: false,
    };
  }

  if (params.memoryCount === 0 && (params.workspaceArtifactCount > 0 || params.reflectionArtifactCount > 0)) {
    return {
      kind: "workspace-rehydrate",
      reason: "Workspace or reflection artifacts exist even though the DB is empty.",
      safeToAutoRehydrate: true,
    };
  }

  return {
    kind: params.hasLegacyArtifacts ? "upgrade-required" : "resume-existing",
    reason: params.hasLegacyArtifacts
      ? "Legacy artifacts require migration before continuing."
      : "Existing memories are available for resume.",
    safeToAutoRehydrate: !params.hasLegacyArtifacts,
  };
}
