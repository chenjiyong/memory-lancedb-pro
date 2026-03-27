import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  buildContinuityPacket,
  renderContinuityPacket,
} = jiti("../src/continuity-packet.ts");

describe("continuity packet", () => {
  it("builds the expected sections from recent memories and reflection slices", () => {
    const now = Date.UTC(2026, 2, 27, 12, 0, 0);
    const packet = buildContinuityPacket({
      now,
      memories: [
        {
          id: "m1",
          text: "Current task: wire runtime health checks into plugin startup.",
          category: "decision",
          timestamp: now - 1_000,
          metadata: JSON.stringify({
            l0_abstract: "Wire runtime health checks into plugin startup",
            activity_domain: "dev",
            artifact_kind: "progress",
            resume_priority: 0.9,
            resource_refs: ["index.ts"],
          }),
        },
        {
          id: "m2",
          text: "Use `rg` and targeted tests before widening verification.",
          category: "preference",
          timestamp: now - 2_000,
          metadata: JSON.stringify({
            l0_abstract: "Prefer rg and targeted tests first",
            activity_domain: "dev",
            artifact_kind: "tool",
            tool_refs: ["rg", "node --test"],
            resume_priority: 0.8,
          }),
        },
        {
          id: "m3",
          text: "Need to add benchmark fixture runner under scripts/benchmarks.",
          category: "fact",
          timestamp: now - 3_000,
          metadata: JSON.stringify({
            l0_abstract: "Add benchmark fixture runner",
            activity_domain: "dev",
            artifact_kind: "open_loop",
            resource_refs: ["scripts/benchmarks"],
            resume_priority: 0.85,
          }),
        },
      ],
      reflectionSlices: {
        invariants: ["Keep index.ts as composition root."],
        derived: ["Next run finish the benchmark fixture runner."],
      },
      maxChars: 1_000,
    });

    assert.match(packet.current_focus.join("\n"), /runtime health checks/);
    assert.match(packet.open_loops.join("\n"), /benchmark fixture runner/);
    assert.match(packet.preferred_tools.join("\n"), /rg/);
    assert.match(packet.next_resume.join("\n"), /Next run finish the benchmark fixture runner/);

    const rendered = renderContinuityPacket(packet);
    assert.match(rendered, /<continuity-packet>/);
    assert.match(rendered, /<current-focus>/);
    assert.match(rendered, /<next-resume>/);
  });

  it("respects the maxChars budget", () => {
    const packet = buildContinuityPacket({
      now: Date.UTC(2026, 2, 27, 12, 0, 0),
      memories: Array.from({ length: 8 }, (_, index) => ({
        id: `m-${index}`,
        text: `long memory ${index} ${"x".repeat(120)}`,
        category: "fact",
        timestamp: Date.now() - index,
        metadata: JSON.stringify({
          l0_abstract: `long memory ${index} ${"x".repeat(120)}`,
          artifact_kind: "progress",
          resume_priority: 0.9 - index * 0.01,
        }),
      })),
      reflectionSlices: {
        invariants: [],
        derived: [],
      },
      maxChars: 220,
    });

    const rendered = renderContinuityPacket(packet);
    assert.ok(rendered.length <= 220);
  });
});
