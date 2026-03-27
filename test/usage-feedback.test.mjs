import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  buildInjectionFeedbackPatch,
  buildConfirmedUsePatch,
  buildAgentEndFeedbackPatch,
  detectRecallUsage,
} = jiti("../src/usage-feedback.ts");

describe("usage feedback", () => {
  it("increments bad recall counters for stale reinjection and schedules suppression at threshold", () => {
    const patch = buildInjectionFeedbackPatch({
      injected_count: 2,
      last_injected_at: 100,
      last_confirmed_use_at: 50,
      bad_recall_count: 2,
      suppressed_until_turn: 0,
      resume_priority: 0.5,
    }, {
      injectedAt: 200,
      currentTurn: 12,
      minRepeated: 8,
    });

    assert.equal(patch.injected_count, 3);
    assert.equal(patch.bad_recall_count, 3);
    assert.equal(patch.suppressed_until_turn, 20);
    assert.ok(patch.resume_priority < 0.5);
  });

  it("resets bad recall counters and lifts resume priority on confirmed use", () => {
    const patch = buildConfirmedUsePatch({
      access_count: 4,
      bad_recall_count: 2,
      suppressed_until_turn: 16,
      resume_priority: 0.4,
    }, {
      usedAt: 500,
      accessDelta: 1,
    });

    assert.equal(patch.access_count, 5);
    assert.equal(patch.last_confirmed_use_at, 500);
    assert.equal(patch.bad_recall_count, 0);
    assert.equal(patch.suppressed_until_turn, 0);
    assert.ok(patch.resume_priority > 0.4);
  });

  it("detects when an injected memory is reflected in the agent response", () => {
    const used = detectRecallUsage(
      "Use rg and node --test for targeted checks before npm test.",
      "I continued with rg first, then used node --test before running the broader regression.",
    );

    assert.equal(used, true);
  });

  it("raises false-positive feedback when an injected memory does not appear to help the response", () => {
    const patch = buildAgentEndFeedbackPatch({
      injected_count: 3,
      bad_recall_count: 1,
      false_positive_recall_count: 0,
      resume_priority: 0.6,
    }, {
      usedAt: 800,
      wasUsed: false,
      actedOn: false,
    });

    assert.equal(patch.false_positive_recall_count, 1);
    assert.equal(patch.bad_recall_count, 2);
    assert.ok(patch.resume_priority < 0.6);
  });

  it("rewards recalls that were used in the final answer or action", () => {
    const patch = buildAgentEndFeedbackPatch({
      access_count: 2,
      used_count: 1,
      resume_effective_count: 0,
      resume_priority: 0.5,
    }, {
      usedAt: 900,
      wasUsed: true,
      actedOn: true,
    });

    assert.equal(patch.access_count, 3);
    assert.equal(patch.used_count, 2);
    assert.equal(patch.resume_effective_count, 1);
    assert.equal(patch.last_confirmed_use_at, 900);
    assert.ok(patch.resume_priority > 0.5);
  });
});
