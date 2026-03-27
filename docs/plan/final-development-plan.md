# Memory-LanceDB-Pro Final Development Plan

## Summary

- Keep the plugin as an OpenClaw `memory` slot backed by LanceDB.
- Preserve the current public tool and CLI names.
- Reuse the existing `sessionStrategy`, `memoryReflection`, `session-recovery`, `self-improvement`, `memory-compactor`, and host-functional test paths.
- Keep `index.ts` as the composition root; move continuity, scenario routing, runtime health, and usage feedback into dedicated modules.

## Architecture

- `src/runtime-health.ts` owns startup health reporting.
- `src/runtime-rehydrate.ts` owns install/upgrade/resume classification.
- `src/continuity-packet.ts` builds a bounded continuity packet from existing memories and reflection slices.
- `src/scenario-router.ts` classifies `dev | learning | research` requests and boosts artifact kinds without hard filtering.
- `src/usage-feedback.ts` owns injection/confirmed-use metadata patches.
- `src/smart-metadata.ts` remains the single source of truth for governance, routing, and continuity metadata fields.

## Interfaces

- Public tools remain: `memory_recall`, `memory_store`, `memory_forget`, `memory_update`.
- Public CLI remains: `memory-pro ...`; add `memory-pro doctor` for runtime diagnostics.
- `SmartMemoryMetadata` now supports optional fields:
  - `activity_domain`
  - `artifact_kind`
  - `resume_priority`
  - `project_key`
  - `resource_refs`
  - `tool_refs`
  - `skill_refs`

## Implementation Stages

1. Stabilize baseline tests before feature work.
2. Add runtime health + rehydrate classification.
3. Add continuity packet generation and inject it ahead of ordinary recall.
4. Add scenario routing and artifact-kind score boosts.
5. Add usage feedback patches for auto-recall and confirmed manual recall.
6. Add a local benchmark fixture runner and smoke test to make release gates executable inside this repo.

## Verification

- Unit tests for runtime health, continuity packet, scenario routing, usage feedback, governance metadata, and benchmark fixture runner.
- Existing regression suites remain in place, including recall cleanup, reflection hooks, CLI smoke, host functional coverage, and manifest regression.
- Compatibility baseline remains OpenClaw `2026.3.22` and `2026.3.23`.

## Notes

- `docs/plan/openclaw-memory-comparison-objective.md` remains the fact baseline outside this worktree plan.
- The original draft files were not present inside this git worktree, so this branch adds the canonical plan file rather than moving absent local-only drafts.
- Follow-on optimization assessment: `docs/plan/ongoing-optimization-assessment.md`.
- Follow-on implementation roadmap: `docs/plan/ongoing-optimization-implementation-plan.md`.
