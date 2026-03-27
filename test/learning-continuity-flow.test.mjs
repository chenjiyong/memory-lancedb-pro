import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { buildContinuityPacket } = jiti("../src/continuity-packet.ts");

describe("learning continuity flow", () => {
  it("extracts topic, knowledge gap, explanation preference, and next learning step", () => {
    const now = Date.UTC(2026, 2, 27, 19, 0, 0);
    const packet = buildContinuityPacket({
      now,
      memories: [
        {
          id: "learning-focus",
          text: "Topic: hybrid retrieval and rerank tradeoffs. Knowledge gap: explain BM25, vector recall, and rerank in one concise example. Next step: compare lexical recall and semantic recall with one code-oriented walkthrough.",
          category: "fact",
          timestamp: now - 1000,
          metadata: JSON.stringify({
            l0_abstract: "Learn hybrid retrieval and rerank tradeoffs",
            activity_domain: "learning",
            artifact_kind: "progress",
            project_key: "memory-lancedb-pro",
            resource_refs: ["docs/benchmarks.md"],
            resume_priority: 0.94,
          }),
        },
        {
          id: "learning-preference",
          text: "Explanation preference: use short examples first, then give the underlying theory.",
          category: "preference",
          timestamp: now - 2000,
          metadata: JSON.stringify({
            l0_abstract: "Prefer short examples before theory",
            activity_domain: "learning",
            artifact_kind: "preference",
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

    assert.match(packet.current_focus.join("\n"), /hybrid retrieval|rerank/i);
    assert.match(packet.open_loops.join("\n"), /knowledge gap|BM25|semantic recall/i);
    assert.match(packet.preferred_tools.join("\n"), /short examples|underlying theory|Explanation preference/i);
    assert.match(packet.next_resume.join("\n"), /compare lexical recall and semantic recall/i);
  });
});
