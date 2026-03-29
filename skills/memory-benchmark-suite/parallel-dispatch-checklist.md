# Parallel Benchmark Dispatch Checklist

## Pre-Dispatch

- [ ] Record active benchmark processes before launching child sessions.
- [ ] Decide which benchmarks are being dispatched.
- [ ] Assign one child session per benchmark.
- [ ] Assign a dedicated benchmark directory or output subtree per child session.
- [ ] Assign a dedicated log file path per child session.
- [ ] Record the provider key strategy for each child session.
- [ ] Confirm that no child session will reuse another run's artifact directory.
- [ ] Confirm whether each run is smoke, partial, or full.

## Child-Session Payload

- [ ] Benchmark name included.
- [ ] Official source included.
- [ ] Repo-local support status included.
- [ ] Working directory included.
- [ ] Output directory included.
- [ ] Log path included.
- [ ] Provider/key constraints included.
- [ ] Non-interference requirement included.
- [ ] Facts-only reporting requirement included.

## During Execution

- [ ] Child session reports the actual command it executed.
- [ ] Child session records artifact paths.
- [ ] Child session records observed blockers.
- [ ] Child session records sample or dataset scope.
- [ ] Child session does not stop or overwrite sibling runs.

## Result Collection

- [ ] Official source captured.
- [ ] Commands captured.
- [ ] Sample scope captured.
- [ ] Artifact paths captured.
- [ ] Status captured.
- [ ] Metrics captured.
- [ ] Blockers or source gaps captured.

## Final Rollup

- [ ] Each benchmark summarized in its own section first.
- [ ] Incomparable metrics kept separate.
- [ ] Final table uses only returned results.
- [ ] Source-gap benchmarks remain marked as source gap.
