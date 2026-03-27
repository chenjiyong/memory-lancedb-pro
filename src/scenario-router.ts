import { parseSmartMetadata } from "./smart-metadata.js";

export type ScenarioDomain = "dev" | "learning" | "research" | "general";
export type ScenarioConfidence = "high" | "medium" | "low";

export interface ScenarioSignal {
  domain: ScenarioDomain;
  confidence: ScenarioConfidence;
  artifactBoosts: Record<string, number>;
}

export interface ScenarioContext {
  continuityText?: string;
  projectKey?: string;
  recentHintText?: string;
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

function detectFromText(text: string): ScenarioDomain {
  if (DEV_PATTERNS.some((pattern) => pattern.test(text))) return "dev";
  if (LEARNING_PATTERNS.some((pattern) => pattern.test(text))) return "learning";
  if (RESEARCH_PATTERNS.some((pattern) => pattern.test(text))) return "research";
  return "general";
}

function buildBoosts(domain: ScenarioDomain): Record<string, number> {
  switch (domain) {
    case "dev":
      return {
        progress: 1.22,
        open_loop: 1.18,
        decision: 1.14,
        tool: 1.12,
        skill: 1.12,
        resource: 1.1,
      };
    case "learning":
      return {
        preference: 1.18,
        resource: 1.14,
        open_loop: 1.1,
      };
    case "research":
      return {
        resource: 1.22,
        decision: 1.14,
        open_loop: 1.1,
      };
    default:
      return {};
  }
}

export function detectScenario(query: string, context?: ScenarioContext): ScenarioSignal {
  const trimmed = query.trim();
  const queryDomain = trimmed ? detectFromText(trimmed) : "general";
  if (queryDomain !== "general") {
    return buildSignal(queryDomain, "high", buildBoosts(queryDomain));
  }

  const contextText = [
    typeof context?.continuityText === "string" ? context.continuityText : "",
    typeof context?.projectKey === "string" ? context.projectKey : "",
    typeof context?.recentHintText === "string" ? context.recentHintText : "",
  ].filter(Boolean).join("\n");
  const contextDomain = contextText ? detectFromText(contextText) : "general";
  if (contextDomain !== "general") {
    return buildSignal(contextDomain, "medium", buildBoosts(contextDomain));
  }

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
      const activityDomain = typeof metadata.activity_domain === "string" ? metadata.activity_domain : "";
      const artifactBoost = signal.artifactBoosts[artifactKind] ?? 1;
      const domainBoost = activityDomain === signal.domain ? 1.08 : 1;
      const boost = artifactBoost * domainBoost;
      return boost === 1 ? result : { ...result, score: result.score * boost };
    })
    .sort((left, right) => right.score - left.score);
}
