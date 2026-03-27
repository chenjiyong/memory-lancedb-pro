type FeedbackMeta = {
  access_count?: number;
  injected_count?: number;
  last_injected_at?: number;
  last_confirmed_use_at?: number;
  used_count?: number;
  last_used_at?: number;
  bad_recall_count?: number;
  false_positive_recall_count?: number;
  suppressed_until_turn?: number;
  resume_effective_count?: number;
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

function tokenize(value: string): string[] {
  const compact = value.toLowerCase();
  const latin = compact.match(/[a-z0-9_./-]+/g) || [];
  const cjk = compact.match(/[\u4e00-\u9fff]{2,}/g) || [];
  return [...new Set([...latin, ...cjk].filter((token) => token.length >= 2))];
}

export function detectRecallUsage(injectedText: string, responseText: string): boolean {
  const injectedTokens = tokenize(injectedText);
  if (injectedTokens.length === 0) return false;
  const responseTokens = new Set(tokenize(responseText));
  let overlap = 0;
  for (const token of injectedTokens) {
    if (responseTokens.has(token)) overlap++;
  }
  return overlap >= Math.min(2, injectedTokens.length);
}

export function buildAgentEndFeedbackPatch(
  meta: FeedbackMeta,
  params: { usedAt: number; wasUsed: boolean; actedOn?: boolean },
) {
  const actedOn = params.actedOn === true;
  if (params.wasUsed || actedOn) {
    return {
      access_count: clampCount(meta.access_count, 0) + 1,
      used_count: clampCount(meta.used_count, 0) + 1,
      last_used_at: params.usedAt,
      last_confirmed_use_at: params.usedAt,
      bad_recall_count: 0,
      false_positive_recall_count: clampCount(meta.false_positive_recall_count, 0),
      suppressed_until_turn: 0,
      resume_effective_count: clampCount(meta.resume_effective_count, 0) + (actedOn ? 1 : 0),
      resume_priority: Math.min(1, clamp01(meta.resume_priority, 0.5) + (actedOn ? 0.16 : 0.12)),
    };
  }

  return {
    bad_recall_count: clampCount(meta.bad_recall_count, 0) + 1,
    false_positive_recall_count: clampCount(meta.false_positive_recall_count, 0) + 1,
    resume_priority: Math.max(0, clamp01(meta.resume_priority, 0.5) - 0.08),
  };
}
