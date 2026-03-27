#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import jitiFactory from "jiti";

const fixturePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("test/fixtures/benchmark/runtime-fixtures.json");

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { detectScenario, applyScenarioBoost } = jiti("../src/scenario-router.ts");

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const raw = await readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];

  const results = cases.map((fixture) => {
    const signal = detectScenario(String(fixture.query || ""));
    const ranked = applyScenarioBoost(
      (fixture.results || []).map((item) => ({
        entry: {
          id: item.id,
          text: item.text,
          metadata: JSON.stringify(item.metadata || {}),
        },
        score: Number(item.score || 0),
      })),
      signal,
    );
    const topArtifactKind = ranked[0]?.entry?.metadata
      ? JSON.parse(ranked[0].entry.metadata).artifact_kind
      : undefined;
    return {
      name: fixture.name,
      domain: signal.domain,
      expectedDomain: fixture.expectedDomain,
      expectedTopArtifactKind: fixture.expectedTopArtifactKind,
      topArtifactKind,
      pass:
        signal.domain === fixture.expectedDomain &&
        topArtifactKind === fixture.expectedTopArtifactKind,
    };
  });

  const summary = {
    fixturePath,
    total: results.length,
    passed: results.filter((item) => item.pass).length,
    failed: results.filter((item) => !item.pass).length,
    results,
  };

  console.log(formatJson(summary));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("benchmark fixture runner failed:", error);
  process.exit(1);
});
