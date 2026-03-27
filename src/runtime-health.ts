export type RuntimeHealthStatus = "pass" | "warn" | "fail" | "unknown";
export type RuntimeHealthMode = "healthy" | "degraded" | "blocked";

export interface RuntimeHealthCheck {
  key:
    | "openclawVersion"
    | "slot"
    | "allowlist"
    | "loadPath"
    | "dbPath"
    | "workspaceDir"
    | "hookRegistry";
  status: RuntimeHealthStatus;
  summary: string;
}

export interface RuntimeHealthReport {
  pluginId: string;
  pluginRoot?: string;
  dbPath?: string;
  workspaceDir?: string;
  openclawVersion?: string;
  mode: RuntimeHealthMode;
  status: RuntimeHealthStatus;
  checks: RuntimeHealthCheck[];
}

export interface RuntimeHealthReportParams {
  pluginId: string;
  pluginRoot?: string;
  dbPath?: string;
  workspaceDir?: string;
  openclawVersion?: string;
  pluginSlot?: string;
  allowlist?: string[];
  loadPaths?: string[];
  requiredHooks?: string[];
  registeredHooks?: string[];
}

const MIN_OPENCLAW_VERSION = "2026.3.22";

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value))
    .filter((value): value is string => Boolean(value));
}

function compareVersion(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });

  const left = parse(a);
  const right = parse(b);
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function summarizeHooks(requiredHooks: string[], registeredHooks: string[]): RuntimeHealthCheck {
  if (requiredHooks.length === 0) {
    return {
      key: "hookRegistry",
      status: "unknown",
      summary: "No required hooks declared.",
    };
  }

  if (registeredHooks.length === 0) {
    return {
      key: "hookRegistry",
      status: "unknown",
      summary: `Required hooks declared but runtime registration was not observed: ${requiredHooks.join(", ")}`,
    };
  }

  const missing = requiredHooks.filter((hook) => !registeredHooks.includes(hook));
  if (missing.length > 0) {
    return {
      key: "hookRegistry",
      status: "fail",
      summary: `Missing hooks: ${missing.join(", ")}`,
    };
  }

  return {
    key: "hookRegistry",
    status: "pass",
    summary: `Registered hooks: ${requiredHooks.join(", ")}`,
  };
}

export function buildRuntimeHealthReport(params: RuntimeHealthReportParams): RuntimeHealthReport {
  const pluginId = params.pluginId;
  const pluginRoot = normalizeString(params.pluginRoot);
  const dbPath = normalizeString(params.dbPath);
  const workspaceDir = normalizeString(params.workspaceDir);
  const openclawVersion = normalizeString(params.openclawVersion);
  const pluginSlot = normalizeString(params.pluginSlot);
  const allowlist = normalizeStringArray(params.allowlist);
  const loadPaths = normalizeStringArray(params.loadPaths);
  const requiredHooks = normalizeStringArray(params.requiredHooks);
  const registeredHooks = normalizeStringArray(params.registeredHooks);

  const checks: RuntimeHealthCheck[] = [];

  checks.push(openclawVersion
    ? {
        key: "openclawVersion",
        status: compareVersion(openclawVersion, MIN_OPENCLAW_VERSION) >= 0 ? "pass" : "warn",
        summary: `OpenClaw version ${openclawVersion}`,
      }
    : {
        key: "openclawVersion",
        status: "unknown",
        summary: "OpenClaw version unavailable.",
      });

  checks.push({
    key: "slot",
    status: pluginSlot === pluginId ? "pass" : "fail",
    summary: pluginSlot === pluginId
      ? `memory slot uses ${pluginId}`
      : `memory slot uses ${pluginSlot || "(unset)"}`,
  });

  checks.push({
    key: "allowlist",
    status: allowlist.includes(pluginId) ? "pass" : "fail",
    summary: allowlist.includes(pluginId)
      ? `${pluginId} present in allowlist`
      : `${pluginId} missing from allowlist`,
  });

  const loadPathReady = !pluginRoot || loadPaths.includes(pluginRoot);
  checks.push({
    key: "loadPath",
    status: loadPathReady ? "pass" : "warn",
    summary: loadPathReady
      ? `Plugin root ${pluginRoot || "(unknown)"} is loadable`
      : `Plugin root ${pluginRoot} not found in load.paths`,
  });

  checks.push({
    key: "dbPath",
    status: dbPath ? "pass" : "fail",
    summary: dbPath ? `DB path ${dbPath}` : "DB path missing.",
  });

  checks.push({
    key: "workspaceDir",
    status: workspaceDir ? "pass" : "warn",
    summary: workspaceDir ? `Workspace dir ${workspaceDir}` : "Workspace dir missing.",
  });

  checks.push(summarizeHooks(requiredHooks, registeredHooks));

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  const hasUnknown = checks.some((check) => check.status === "unknown");

  return {
    pluginId,
    pluginRoot,
    dbPath,
    workspaceDir,
    openclawVersion,
    mode: hasFail ? "blocked" : hasWarn || hasUnknown ? "degraded" : "healthy",
    status: hasFail ? "fail" : hasWarn ? "warn" : hasUnknown ? "unknown" : "pass",
    checks,
  };
}
