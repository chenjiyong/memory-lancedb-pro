import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { buildContinuityPacket } = jiti("../src/continuity-packet.ts");

describe("research continuity flow", () => {
  it("extracts sources, evidence, open questions, and next research step", () => {
    const now = Date.UTC(2026, 2, 27, 20, 0, 0);
    const packet = buildContinuityPacket({
      now,
      memories: [
        {
          id: "research-focus",
          text: "Research topic: benchmark strategy for long-memory agents. Sources: docs/benchmarks.md and https://example.com/memory-bench.pdf. Evidence: current repo only ships a fixture runner. Open question: how should we define release-gate regression thresholds? Next: compare fixture smoke and external adapter metrics side by side.",
          category: "fact",
          timestamp: now - 1000,
          metadata: JSON.stringify({
            l0_abstract: "Benchmark strategy for long-memory agents",
            activity_domain: "research",
            artifact_kind: "resource",
            resource_refs: ["docs/benchmarks.md", "https://example.com/memory-bench.pdf"],
            resume_priority: 0.95,
          }),
        },
        {
          id: "research-decision",
          text: "Decision: keep fixture smoke as the minimum gate even when external datasets are unavailable.",
          category: "decision",
          timestamp: now - 2000,
          metadata: JSON.stringify({
            l0_abstract: "Keep fixture smoke as the minimum benchmark gate",
            activity_domain: "research",
            artifact_kind: "decision",
            resume_priority: 0.9,
          }),
        },
      ],
      reflectionSlices: {
        invariants: [],
        derived: [],
      },
      maxChars: 1200,
    });

    assert.match(packet.resource_refs.join("\n"), /docs\/benchmarks\.md|memory-bench\.pdf/i);
    assert.match(packet.open_loops.join("\n"), /Open question|release-gate regression thresholds/i);
    assert.match(packet.recent_decisions.join("\n"), /fixture smoke as the minimum benchmark gate/i);
    assert.match(packet.next_resume.join("\n"), /compare fixture smoke and external adapter metrics/i);
  });
});
