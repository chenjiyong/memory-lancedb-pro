type FeedbackMeta = {
  access_count?: number;
  injected_count?: number;
  last_injected_at?: number;
  last_confirmed_use_at?: number;
  bad_recall_count?: number;
  suppressed_until_turn?: number;
  resume_priority?: number;
};

function clamp01(value: unknown, fallback = 0.5): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function clampCount(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.floor(num);
}

export function buildInjectionFeedbackPatch(
  meta: FeedbackMeta,
  params: { injectedAt: number; currentTurn: number; minRepeated: number },
) {
  const staleInjected =
    clampCount(meta.last_injected_at, 0) > 0 &&
    clampCount(meta.last_confirmed_use_at, 0) < clampCount(meta.last_injected_at, 0);
  const nextBadRecallCount = staleInjected
    ? clampCount(meta.bad_recall_count, 0) + 1
    : clampCount(meta.bad_recall_count, 0);
  const shouldSuppress = nextBadRecallCount >= 3 && params.minRepeated > 0;
  return {
    injected_count: clampCount(meta.injected_count, 0) + 1,
    last_injected_at: params.injectedAt,
    bad_recall_count: nextBadRecallCount,
    suppressed_until_turn: shouldSuppress
      ? Math.max(clampCount(meta.suppressed_until_turn, 0), params.currentTurn + params.minRepeated)
      : clampCount(meta.suppressed_until_turn, 0),
    resume_priority: Math.max(0, clamp01(meta.resume_priority, 0.5) - (staleInjected ? 0.08 : 0)),
  };
}

export function buildConfirmedUsePatch(
  meta: FeedbackMeta,
  params: { usedAt: number; accessDelta?: number },
) {
  return {
    access_count: clampCount(meta.access_count, 0) + (params.accessDelta ?? 1),
    last_confirmed_use_at: params.usedAt,
    bad_recall_count: 0,
    suppressed_until_turn: 0,
    resume_priority: Math.min(1, clamp01(meta.resume_priority, 0.5) + 0.12),
  };
}
