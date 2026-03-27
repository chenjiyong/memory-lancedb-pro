import { parseSmartMetadata } from "./smart-metadata.js";

export type ScenarioDomain = "dev" | "learning" | "research" | "general";
export type ScenarioConfidence = "high" | "medium" | "low";

export interface ScenarioSignal {
  domain: ScenarioDomain;
  confidence: ScenarioConfidence;
  artifactBoosts: Record<string, number>;
}

const DEV_PATTERNS = [
  /\b(code|coding|bug|test|tests|build|refactor|hook|plugin|index\.ts|typescript|function|api|pr|diff)\b/i,
  /(修复|测试|代码|实现|插件|钩子|构建|继续开发|回归)/,
];

const LEARNING_PATTERNS = [
  /\b(learn|learning|understand|explain|tutorial|study|teach)\b/i,
  /(学习|解释|理解|教程|讲解)/,
];

const RESEARCH_PATTERNS = [
  /\b(research|compare|comparison|source|evidence|cite|investigate|benchmark)\b/i,
  /(调研|对比|资料|来源|证据|基准|研究)/,
];

function buildSignal(domain: ScenarioDomain, confidence: ScenarioConfidence, artifactBoosts: Record<string, number>): ScenarioSignal {
  return { domain, confidence, artifactBoosts };
}

export function detectScenario(query: string): ScenarioSignal {
  const trimmed = query.trim();
  if (!trimmed) return buildSignal("general", "low", {});
  if (DEV_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return buildSignal("dev", "high", {
      progress: 1.22,
      open_loop: 1.18,
      decision: 1.14,
      tool: 1.12,
      skill: 1.12,
      resource: 1.1,
    });
  }
  if (LEARNING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return buildSignal("learning", "high", {
      preference: 1.18,
      resource: 1.14,
      open_loop: 1.1,
    });
  }
  if (RESEARCH_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return buildSignal("research", "high", {
      resource: 1.22,
      decision: 1.14,
      open_loop: 1.1,
    });
  }
  return buildSignal("general", "low", {});
}

export function applyScenarioBoost<
  T extends { entry: { metadata?: string; category?: string }; score: number },
>(results: T[], signal: ScenarioSignal): T[] {
  if (signal.domain === "general") return results;

  return [...results]
    .map((result) => {
      const metadata = parseSmartMetadata(result.entry.metadata, result.entry);
      const artifactKind = typeof metadata.artifact_kind === "string" ? metadata.artifact_kind : "";
      const boost = signal.artifactBoosts[artifactKind] ?? 1;
      return boost === 1 ? result : { ...result, score: Math.min(1, result.score * boost) };
    })
    .sort((left, right) => right.score - left.score);
}
