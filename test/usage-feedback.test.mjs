import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  buildInjectionFeedbackPatch,
  buildConfirmedUsePatch,
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
});
