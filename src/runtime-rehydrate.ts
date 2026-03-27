import type { RuntimeHealthReport } from "./runtime-health.js";

export interface RehydrateDecision {
  kind: "fresh-install" | "workspace-rehydrate" | "resume-existing" | "upgrade-required";
  state:
    | "fresh-install"
    | "workspace-rehydrate"
    | "resume-ready"
    | "stale-artifacts"
    | "migrate-pending"
    | "runtime-blocked";
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
      state: "runtime-blocked",
      reason: "Runtime health checks are blocked.",
      safeToAutoRehydrate: false,
    };
  }

  if (params.memoryCount === 0 && params.workspaceArtifactCount === 0 && params.reflectionArtifactCount === 0) {
    return {
      kind: "fresh-install",
      state: "fresh-install",
      reason: "No prior memories or workspace artifacts were found.",
      safeToAutoRehydrate: false,
    };
  }

  if (params.memoryCount === 0 && (params.workspaceArtifactCount > 0 || params.reflectionArtifactCount > 0)) {
    return {
      kind: "workspace-rehydrate",
      state: "workspace-rehydrate",
      reason: "Workspace or reflection artifacts exist even though the DB is empty.",
      safeToAutoRehydrate: true,
    };
  }

  if (params.hasLegacyArtifacts) {
    return {
      kind: "upgrade-required",
      state: "migrate-pending",
      reason: "Legacy artifacts require migration before continuing.",
      safeToAutoRehydrate: false,
    };
  }

  if (params.workspaceArtifactCount > 0 || params.reflectionArtifactCount > 0) {
    return {
      kind: "resume-existing",
      state: "stale-artifacts",
      reason: "Existing memories are available, but extra workspace or reflection artifacts should be reviewed during resume.",
      safeToAutoRehydrate: true,
    };
  }

  return {
    kind: "resume-existing",
    state: "resume-ready",
    reason: "Existing memories are available for resume.",
    safeToAutoRehydrate: true,
  };
}
