import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--agent-dir") {
      args.agentDir = argv[++i];
      continue;
    }
    if (arg === "--agent-id") {
      args.agentId = argv[++i];
      continue;
    }
  }
  return args;
}

function resolveOpenClawHome() {
  return process.env.OPENCLAW_HOME?.trim()
    ? path.resolve(process.env.OPENCLAW_HOME.trim())
    : path.join(homedir(), ".openclaw");
}

function resolveAgentDir(args) {
  if (typeof args.agentDir === "string" && args.agentDir.trim()) {
    return path.resolve(args.agentDir.trim());
  }
  if (typeof args.agentId === "string" && args.agentId.trim()) {
    return path.join(resolveOpenClawHome(), "agents", args.agentId.trim());
  }
  throw new Error("Provide either --agent-dir <path> or --agent-id <id>.");
}

function loadJsonArrayLength(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed.length : (parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0);
  } catch {
    return 0;
  }
}

function buildCheck(key, filePath, label) {
  const exists = existsSync(filePath);
  return {
    key,
    status: exists ? "pass" : "fail",
    path: filePath,
    summary: exists ? `${label} present` : `${label} missing`,
    itemCount: exists ? loadJsonArrayLength(filePath) : 0,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const agentDir = resolveAgentDir(args);
  const modelsPath = path.join(agentDir, "agent", "models.json");
  const authProfilesPath = path.join(agentDir, "agent", "auth-profiles.json");

  const checks = [
    buildCheck("modelsIndex", modelsPath, "models.json"),
    buildCheck("authProfiles", authProfilesPath, "auth-profiles.json"),
  ];
  const status = checks.every((check) => check.status === "pass") ? "pass" : "fail";
  const summary = {
    status,
    agentDir,
    checks,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Agent bootstrap: ${status}`);
    console.log(`Agent dir: ${agentDir}`);
    for (const check of checks) {
      console.log(`- ${check.key}: ${check.status} - ${check.summary}`);
    }
  }

  if (status !== "pass") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
