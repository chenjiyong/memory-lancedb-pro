import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  detectScenario,
  applyScenarioBoost,
} = jiti("../src/scenario-router.ts");

describe("scenario router", () => {
  it("detects development queries", () => {
    const signal = detectScenario("继续修复 before_prompt_build 的测试失败，并更新 index.ts");
    assert.equal(signal.domain, "dev");
    assert.equal(signal.confidence, "high");
  });

  it("detects learning queries", () => {
    const signal = detectScenario("解释一下这个检索流程是怎么工作的，我想学习它");
    assert.equal(signal.domain, "learning");
  });

  it("detects research queries", () => {
    const signal = detectScenario("整理一下这个方案的资料来源和客观对比结论");
    assert.equal(signal.domain, "research");
  });

  it("boosts progress/open_loop memories for development scenarios", () => {
    const signal = detectScenario("继续开发 continuity packet 和 benchmark runner");
    const results = applyScenarioBoost([
      {
        entry: {
          category: "fact",
          metadata: JSON.stringify({ artifact_kind: "preference" }),
        },
        score: 0.9,
      },
      {
        entry: {
          category: "fact",
          metadata: JSON.stringify({ artifact_kind: "progress" }),
        },
        score: 0.82,
      },
    ], signal);

    assert.equal(JSON.parse(results[0].entry.metadata).artifact_kind, "progress");
  });
});
