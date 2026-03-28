import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("bootstrap check reports missing model/auth indexes", async () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "memory-bootstrap-check-"));
  const agentDir = path.join(tempDir, "agents", "alpha");
  mkdirSync(path.join(agentDir, "agent"), { recursive: true });
  const scriptPath = path.join(repoRoot, "scripts", "openclaw", "check-agent-bootstrap.mjs");

  try {
    await assert.rejects(
      execFileAsync("node", [scriptPath, "--agent-dir", agentDir, "--json"], { cwd: repoRoot }),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.status, "fail");
        assert.equal(parsed.checks.find((check) => check.key === "modelsIndex")?.status, "fail");
        assert.equal(parsed.checks.find((check) => check.key === "authProfiles")?.status, "fail");
        return true;
      },
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("bootstrap check passes when both model and auth indexes exist", async () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "memory-bootstrap-check-"));
  const agentDir = path.join(tempDir, "agents", "beta");
  const dataDir = path.join(agentDir, "agent");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "models.json"), JSON.stringify([{ id: "openai-codex/gpt-5.4" }], null, 2));
  writeFileSync(path.join(dataDir, "auth-profiles.json"), JSON.stringify([{ id: "default" }], null, 2));
  const scriptPath = path.join(repoRoot, "scripts", "openclaw", "check-agent-bootstrap.mjs");

  try {
    const { stdout } = await execFileAsync("node", [scriptPath, "--agent-dir", agentDir, "--json"], { cwd: repoRoot });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.status, "pass");
    assert.equal(parsed.checks.find((check) => check.key === "modelsIndex")?.status, "pass");
    assert.equal(parsed.checks.find((check) => check.key === "authProfiles")?.status, "pass");
    assert.equal(parsed.agentDir, agentDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
