import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { buildContinuityPacket } = jiti("../src/continuity-packet.ts");

describe("development continuity flow", () => {
  it("extracts file focus, next action, failure-avoidance, and workflow hints for dev sessions", () => {
    const now = Date.UTC(2026, 2, 27, 18, 0, 0);
    const packet = buildContinuityPacket({
      now,
      memories: [
        {
          id: "dev-progress",
          text: "Done: unify runtime inspection. Next: wire doctor and startup to share the same state object. Avoid touching the live store before retriever setup. Current files: src/runtime-inspection.ts cli.ts index.ts",
          category: "decision",
          timestamp: now - 1000,
          metadata: JSON.stringify({
            l0_abstract: "Unify runtime inspection for startup and doctor",
            activity_domain: "dev",
            artifact_kind: "progress",
            project_key: "memory-lancedb-pro",
            resource_refs: ["src/runtime-inspection.ts", "cli.ts", "index.ts"],
            resume_priority: 0.96,
          }),
        },
        {
          id: "dev-tools",
          text: "Workflow: use `rg` for search, then `node --test` for targeted checks before widening to npm test.",
          category: "preference",
          timestamp: now - 2000,
          metadata: JSON.stringify({
            l0_abstract: "Use rg and targeted node --test runs first",
            activity_domain: "dev",
            artifact_kind: "tool",
            tool_refs: ["rg", "node --test", "npm test"],
            resume_priority: 0.9,
          }),
        },
      ],
      reflectionSlices: {
        invariants: ["Prefer targeted tests before full regression."],
        derived: ["Blocked if hook observation forces startup into a false upgrade-required state."],
      },
      maxChars: 1200,
    });

    assert.match(packet.current_focus.join("\n"), /src\/runtime-inspection\.ts|cli\.ts|index\.ts/);
    assert.match(packet.next_resume.join("\n"), /wire doctor and startup to share the same state object/i);
    assert.match(packet.open_loops.join("\n"), /Blocked if hook observation/i);
    assert.match(packet.preferred_tools.join("\n"), /rg|node --test/);
    assert.match(packet.resource_refs.join("\n"), /src\/runtime-inspection\.ts/);
  });
});
