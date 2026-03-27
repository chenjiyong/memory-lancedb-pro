import { parseSmartMetadata } from "./smart-metadata.js";

export interface ContinuityPacket {
  current_focus: string[];
  recent_decisions: string[];
  open_loops: string[];
  preferred_tools: string[];
  resource_refs: string[];
  next_resume: string[];
}

interface ContinuityPacketParams {
  now: number;
  memories: Array<{
    id: string;
    text: string;
    category?: string;
    timestamp?: number;
    metadata?: string;
  }>;
  reflectionSlices: {
    invariants: string[];
    derived: string[];
  };
  maxChars?: number;
}

type WeightedLine = { text: string; weight: number };

const DEFAULT_MAX_CHARS = 900;

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function extractResourceRefs(text: string): string[] {
  const matches = text.match(/`[^`]+`|https?:\/\/\S+|[A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+/g) || [];
  return uniqueLines(matches.map((match) => match.replace(/^`|`$/g, "")));
}

function pushWeighted(target: WeightedLine[], text: string, weight: number): void {
  const normalized = normalizeLine(text);
  if (!normalized) return;
  target.push({ text: normalized, weight });
}

function topLines(lines: WeightedLine[], limit: number): string[] {
  return uniqueLines(
    [...lines]
      .sort((left, right) => right.weight - left.weight)
      .slice(0, limit)
      .map((line) => line.text),
  );
}

function collectPacket(params: ContinuityPacketParams): ContinuityPacket {
  const focus: WeightedLine[] = [];
  const decisions: WeightedLine[] = [];
  const openLoops: WeightedLine[] = [];
  const tools: WeightedLine[] = [];
  const resources: WeightedLine[] = [];
  const nextResume: WeightedLine[] = [];

  for (const memory of params.memories) {
    const metadata = parseSmartMetadata(memory.metadata, memory);
    const artifactKind = typeof metadata.artifact_kind === "string" ? metadata.artifact_kind : "";
    const resumePriority = typeof metadata.resume_priority === "number" ? metadata.resume_priority : 0.5;
    const summary = metadata.l0_abstract || memory.text;
    const weight = resumePriority * 100 + (memory.timestamp ?? params.now) / 1_000_000_000;

    if (artifactKind === "progress" || artifactKind === "resource") pushWeighted(focus, summary, weight);
    if (artifactKind === "decision" || memory.category === "decision") pushWeighted(decisions, summary, weight);
    if (artifactKind === "open_loop") {
      pushWeighted(openLoops, summary, weight);
      pushWeighted(nextResume, summary, weight);
    }
    if (artifactKind === "tool" || artifactKind === "skill" || metadata.tool_refs || metadata.skill_refs) {
      pushWeighted(tools, summary, weight);
    }

    const metadataResourceRefs = [
      ...(Array.isArray(metadata.resource_refs) ? metadata.resource_refs.map(String) : []),
      ...(Array.isArray(metadata.tool_refs) ? metadata.tool_refs.map(String) : []),
      ...(Array.isArray(metadata.skill_refs) ? metadata.skill_refs.map(String) : []),
      ...extractResourceRefs(memory.text),
    ];
    for (const resourceRef of metadataResourceRefs) {
      pushWeighted(resources, resourceRef, weight);
    }
  }

  for (const derived of params.reflectionSlices.derived) {
    pushWeighted(openLoops, derived, 80);
    pushWeighted(nextResume, derived, 90);
  }

  for (const invariant of params.reflectionSlices.invariants) {
    pushWeighted(tools, invariant, 60);
  }

  return {
    current_focus: topLines(focus, 2),
    recent_decisions: topLines(decisions, 2),
    open_loops: topLines(openLoops, 3),
    preferred_tools: topLines(tools, 3),
    resource_refs: topLines(resources, 4),
    next_resume: topLines(nextResume, 2),
  };
}

function serializeSections(packet: ContinuityPacket): string[] {
  const sections: Array<[string, string, string[]]> = [
    ["current_focus", "current-focus", packet.current_focus],
    ["recent_decisions", "recent-decisions", packet.recent_decisions],
    ["open_loops", "open-loops", packet.open_loops],
    ["preferred_tools", "preferred-tools", packet.preferred_tools],
    ["resource_refs", "resource-refs", packet.resource_refs],
    ["next_resume", "next-resume", packet.next_resume],
  ];

  return sections
    .filter(([, , lines]) => lines.length > 0)
    .map(([label, tag, lines]) => {
      const body = lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
      return `<${tag}>\n${label}\n${body}\n</${tag}>`;
    });
}

function trimPacketToBudget(packet: ContinuityPacket, maxChars: number): ContinuityPacket {
  let next = packet;
  while (renderContinuityPacket(next).length > maxChars) {
    const keys: Array<keyof ContinuityPacket> = [
      "resource_refs",
      "preferred_tools",
      "recent_decisions",
      "open_loops",
      "current_focus",
      "next_resume",
    ];
    let trimmed = false;
    for (const key of keys) {
      if (next[key].length > 1) {
        next = { ...next, [key]: next[key].slice(0, -1) };
        trimmed = true;
        break;
      }
    }
    if (!trimmed) break;
  }
  while (renderContinuityPacket(next).length > maxChars) {
    const keys: Array<keyof ContinuityPacket> = [
      "resource_refs",
      "preferred_tools",
      "recent_decisions",
      "open_loops",
      "current_focus",
      "next_resume",
    ];
    let shortened = false;
    for (const key of keys) {
      const lines = next[key];
      if (lines.length === 0) continue;
      const lastIndex = lines.length - 1;
      const lastLine = lines[lastIndex];
      if (lastLine.length <= 12) continue;
      const clipped = `${lastLine.slice(0, Math.max(8, lastLine.length - 24)).trimEnd()}...`;
      next = {
        ...next,
        [key]: [...lines.slice(0, lastIndex), clipped],
      };
      shortened = true;
      break;
    }
    if (!shortened) break;
  }
  return next;
}

export function buildContinuityPacket(params: ContinuityPacketParams): ContinuityPacket {
  const packet = collectPacket(params);
  return trimPacketToBudget(packet, Math.max(160, params.maxChars ?? DEFAULT_MAX_CHARS));
}

export function renderContinuityPacket(packet: ContinuityPacket): string {
  const sections = serializeSections(packet);
  if (sections.length === 0) return "";
  return `<continuity-packet>\n${sections.join("\n")}\n</continuity-packet>`;
}
