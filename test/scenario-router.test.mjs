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

  it("uses continuity context to classify ambiguous follow-up queries", () => {
    const devSignal = detectScenario("继续这个", {
      continuityText: "current-focus\n1. Files: src/runtime-inspection.ts, cli.ts, index.ts\npreferred-tools\n1. rg\n2. node --test",
    });
    const learningSignal = detectScenario("继续这个", {
      continuityText: "current-focus\n1. 学习向量检索与 BM25\nopen-loops\n1. Need to explain the difference between lexical and semantic recall",
    });

    assert.equal(devSignal.domain, "dev");
    assert.equal(learningSignal.domain, "learning");
  });

  it("adds a domain match boost without hard-filtering non-matching results", () => {
    const signal = detectScenario("继续这个", {
      continuityText: "Files: src/runtime-inspection.ts, cli.ts, index.ts",
    });
    const results = applyScenarioBoost([
      {
        entry: {
          category: "fact",
          metadata: JSON.stringify({ activity_domain: "learning", artifact_kind: "progress" }),
        },
        score: 0.88,
      },
      {
        entry: {
          category: "fact",
          metadata: JSON.stringify({ activity_domain: "dev", artifact_kind: "progress" }),
        },
        score: 0.83,
      },
    ], signal);

    assert.equal(JSON.parse(results[0].entry.metadata).activity_domain, "dev");
    assert.ok(results[1].score > 0);
  });
});
