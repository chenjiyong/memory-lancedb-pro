# Memory-LanceDB-Pro Ongoing Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重做架构的前提下，把 runtime 接管、continuity、scenario routing、usage feedback、OpenClaw 验证矩阵和 benchmark gate 补齐到可持续迭代的生产级水平。

**Architecture:** 保持插件仍是 OpenClaw `memory` slot，保持 LanceDB 单一主存储，保持 `index.ts` 为 composition root。所有新工作优先增强现有 `runtime-health`、`runtime-rehydrate`、`continuity-packet`、`scenario-router`、`usage-feedback` 等模块，不引入第二套状态源。

**Tech Stack:** TypeScript, OpenClaw plugin hooks, LanceDB, existing reflection/sessionStrategy/session-recovery pipeline, Node test runner, OpenClaw host functional harness.

---

## Execution Rules

- 每个任务先补测试或回归用例，再补实现。
- 每个任务完成后至少跑对应的最小测试集。
- 只有当最小测试通过后，才进入下一个任务。
- 每个任务都要保持对 OpenClaw CLI 与插件接口的兼容。

## Current Status (2026-03-28)

- 已完成：
  - Phase 0 文档基线已落库
  - Phase 1 runtime inspection / rehydrate 对齐已实现，并由 `test/runtime-health.test.mjs`、`test/runtime-rehydrate.test.mjs`、`test/cli-smoke.mjs` 覆盖
  - Phase 1.2 已把 `memory-pro doctor --json` 与 `hooks list --json` 接入 `test/openclaw-host-functional.mjs`，并更新了 playbook 的 hook 观测口径
  - Phase 2 continuity packet 已补 dev / learning / research 三类 continuity flow 覆盖
  - Phase 2.2 continuity 注入顺序与组合预算已补回归
  - Phase 3 scenario router 已接入 continuity 上下文，learning / research continuity 测试已补
  - Phase 4 agent-end usage feedback 弱归因已接入并有测试覆盖
  - Phase 5 已补 runtime / recovery matrix、tool loop、scope isolation、`/new` session flow、fresh-agent bootstrap precheck
  - Phase 6 benchmark fixture wrapper / docs 已落地
- 已验证通过：
  - `npm test`
  - `npm run test:openclaw-host`
  - 当前 worktree 指向的临时 profile 上，`plugins info`、`memory-pro doctor --json`、`memory-pro stats --json` 都能在 20 秒内正常退出
- 当前默认环境重新验证：
  - `openclaw config validate` 在 `0.84s` 内返回
  - `openclaw plugins info memory-lancedb-pro` 在 `70.36s` 内返回，状态为 `loaded`
  - `openclaw memory-pro doctor --json` 在 `87.84s` 内返回，`rehydrate=resume-existing/resume-ready`
  - `openclaw memory-pro stats --json` 在 `70.17s` 内返回
  - `openclaw agent --agent main --session-id phase7-live-check --message "只回复三个字：验证通过。" --json` 在 `8.88s` 内返回 `status=ok`
- 已修复：
  - `api.registerService(...start)` 中的后台 timer 改为 `unref()`，避免一次性 CLI 命令被插件保活
  - `doctor` / runtime inspection 对 live 记忆的 legacy 判定已与 upgrader 对齐；存在 `memory_category` 但未显式写入 `source` 的新格式记忆不再被误判为 `migrate-pending`
- 已新增定位结论：
  - 单独复制 live `openclaw.json` 到临时 HOME 即可复现 one-shot CLI 在 `20s` 探测阈值内不返回，说明复现不依赖 live `memory/`、`agents/`、`workspace/` 状态目录
  - 当 `plugins.allow` 只保留 `memory-lancedb-pro` 时，`openclaw plugins info memory-lancedb-pro` 能正常退出
  - 当 `plugins.allow` 额外包含 bundled `telegram` 或 `discord` 时，`openclaw plugins info memory-lancedb-pro`、`openclaw plugins list --json`、`openclaw memory-pro doctor --json`、`openclaw memory-pro stats --json` 会明显慢于 `20s` 探测阈值，但最终仍可返回
  - live `openai-codex:default` 在本轮验证前曾因 refresh token 失效导致 `openclaw agent --json` 失败；重新登录后同一 smoke 已通过

## Phase 0: Baseline and Guardrails

### Task 0.1: Freeze the optimization scope in docs

**Files:**
- Create: `docs/plan/ongoing-optimization-assessment.md`
- Create: `docs/plan/ongoing-optimization-implementation-plan.md`
- Reference: `docs/plan/archive/memory-lancedb-pro提高撸棒性方案.md`
- Reference: `docs/plan/final-development-plan.md`
- Reference: `docs/openclaw-integration-playbook.md`

- [x] 确认持续优化边界：
  - 不改公开工具名
  - 不改 `memory-pro` 主命令面
  - 不新增第二套长期状态源
  - 不把业务逻辑重新塞回 `index.ts`
- [x] 在文档中明确后续阶段顺序、验收标准、OpenClaw 回归矩阵、benchmark gate。
- [x] 检查文档互相引用是否闭环。

Run:

```bash
test -f docs/plan/ongoing-optimization-assessment.md
test -f docs/plan/ongoing-optimization-implementation-plan.md
```

Expected:

- 两份文档都存在。

## Phase 1: Runtime Inspection and Rehydrate Alignment

### Task 1.1: Unify startup inspection and `memory-pro doctor`

**Files:**
- Create: `src/runtime-inspection.ts`
- Modify: `src/runtime-health.ts`
- Modify: `src/runtime-rehydrate.ts`
- Modify: `index.ts`
- Modify: `cli.ts`
- Test: `test/runtime-health.test.mjs`
- Create: `test/runtime-rehydrate.test.mjs`

- [x] 先写失败用例，覆盖以下场景：
  - fresh install
  - empty DB + existing workspace artifacts
  - existing memories
  - legacy/migrate pending
  - stale reflection/session artifacts
- [x] 在 `src/runtime-inspection.ts` 实现统一采集入口，负责收集：
  - db memory count
  - reflection count
  - workspace artifact count
  - legacy artifact presence
  - hook registry observation
- [x] 让 `index.ts` 启动日志与 `cli.ts doctor` 共用同一份 inspection 结果。
- [x] 扩展 `RehydrateDecision`，补齐更细粒度原因码，但保持对外摘要稳定。
- [x] 确保 `session-recovery.ts` 继续只负责路径/输入解析，不承载策略判断。

Run:

```bash
node --test test/runtime-health.test.mjs
node --test test/runtime-rehydrate.test.mjs
node test/cli-smoke.mjs
```

Expected:

- `doctor` 输出与启动期分类一致。
- 运行时健康与 rehydrate 判定在测试中有稳定覆盖。

### Task 1.2: Strengthen OpenClaw runtime regression checks

**Files:**
- Modify: `test/openclaw-host-functional.mjs`
- Modify: `docs/openclaw-integration-playbook.md`

- [x] 为 host functional 增加 `memory-pro doctor --json` 断言。
- [x] 增加对 `hooks list --json` 或等价 hook 观测输出的校验。
- [x] 在 playbook 中统一 runtime health / rehydrate 术语，避免文档与日志命名不一致。

Run:

```bash
node test/openclaw-host-functional.mjs
```

Expected:

- host functional 会同时验证 config、plugin info、doctor、stats 的一致性。

## Phase 2: Continuity Packet V2

### Task 2.1: Add domain-aware continuity extraction

**Files:**
- Modify: `src/continuity-packet.ts`
- Modify: `src/reflection-slices.ts`
- Modify: `src/reflection-store.ts`
- Modify: `src/reflection-ranking.ts`
- Modify: `src/smart-metadata.ts`
- Modify: `index.ts`
- Test: `test/continuity-packet.test.mjs`
- Create: `test/dev-continuity-flow.test.mjs`

- [x] 先补失败测试，覆盖：
  - `current_focus` 包含项目/模块/文件
  - `recent_decisions` 包含确认决策
  - `open_loops` 与 `next_resume` 可区分
  - `preferred_tools` 能吸收 tool/skill/workflow 线索
  - continuity packet 总字符预算可控
- [x] 在 `continuity-packet.ts` 增加领域化提取：
  - 开发：模块、文件、done/todo、failure avoidance、workflow
  - 学习：topic、knowledge gap、explanation preference
  - 研究：sources、evidence、open questions
- [x] 优先复用 reflection slices、recent memories、smart metadata，不写第二套摘要存储。
- [x] 保持 packet 渲染层与 packet 生成层分离。

Run:

```bash
node --test test/continuity-packet.test.mjs
node --test test/dev-continuity-flow.test.mjs
```

Expected:

- continuity packet 既保留固定结构，又能更像“继续工作包”。

### Task 2.2: Inject continuity ahead of generic recall without prompt bloat

**Files:**
- Modify: `index.ts`
- Modify: `test/recall-text-cleanup.test.mjs`
- Modify: `test/reflection-bypass-hook.test.mjs`

- [x] 为 `before_prompt_build` 路径增加预算测试，确认 continuity block 优先出现，但不会导致 recall 区块失控膨胀。
- [x] 保证 continuity packet 与 `<relevant-memories>` 的拼接顺序稳定。
- [x] 确保 continuity packet 构建失败时，普通 recall 仍可独立工作。

Run:

```bash
node --test test/recall-text-cleanup.test.mjs
node --test test/reflection-bypass-hook.test.mjs
```

Expected:

- continuity 注入不会破坏原有 recall hook 行为。

## Phase 3: Scenario Routing V2

### Task 3.1: Expand scenario routing inputs beyond raw query

**Files:**
- Modify: `src/scenario-router.ts`
- Modify: `src/intent-analyzer.ts`
- Modify: `src/adaptive-retrieval.ts`
- Modify: `src/retriever.ts`
- Modify: `src/smart-metadata.ts`
- Modify: `index.ts`
- Test: `test/scenario-router.test.mjs`
- Create: `test/learning-continuity-flow.test.mjs`
- Create: `test/research-continuity-flow.test.mjs`

- [x] 先补失败测试，覆盖：
  - 同一 query 在不同 scenario 输入下排序差异
  - 非主场景高价值记忆不会被硬过滤
  - `general` 场景不受意外 boost 干扰
- [x] 让 scenario router 输入扩展为：
  - query
  - recent continuity packet
  - workspace/project key
  - recent session cues
- [x] 继续坚持“boost 不 hard filter”。
- [x] 扩展 smart metadata 生成逻辑，使 learning / research 记忆能更稳定地产生 metadata facet。

Run:

```bash
node --test test/scenario-router.test.mjs
node --test test/learning-continuity-flow.test.mjs
node --test test/research-continuity-flow.test.mjs
```

Expected:

- 路由差异体现在排序分布，而不是功能性回退。

## Phase 4: Usage Feedback Closed Loop

### Task 4.1: Record injected memories and attribute actual use

**Files:**
- Modify: `src/usage-feedback.ts`
- Modify: `src/access-tracker.ts`
- Modify: `src/retriever.ts`
- Modify: `src/tools.ts`
- Modify: `src/smart-metadata.ts`
- Modify: `index.ts`
- Test: `test/usage-feedback.test.mjs`
- Test: `test/governance-metadata.test.mjs`

- [x] 先补失败测试，覆盖：
  - injected but unused
  - injected and used in answer
  - injected and used in subsequent tool loop
  - repeated stale recall suppression
- [x] 在 `before_prompt_build` 记录注入集合。
- [x] 在 `agent_end` 或等价生命周期节点建立弱归因逻辑。
- [x] metadata 继续复用现有治理字段；必要时增量补充：
  - `used_count`
  - `last_used_at`
  - `false_positive_recall_count`
  - `resume_effective_count`
- [x] 确保 compactor / governance / smart metadata 工作流不被破坏。

Run:

```bash
node --test test/usage-feedback.test.mjs
node --test test/governance-metadata.test.mjs
```

Expected:

- recall 反馈从“注入计数”升级为“实际帮助程度”。

## Phase 5: OpenClaw Regression Matrix

### Task 5.1: Productize OpenClaw continuity and recovery validation

**Files:**
- Modify: `test/openclaw-host-functional.mjs`
- Modify: `test/plugin-manifest-regression.mjs`
- Modify: `docs/openclaw-integration-playbook.md`
- Create: `docs/openclaw-integration-playbook.zh-CN.md` updates if terminology diverges

- [x] 把以下路径纳入自动化矩阵：
  - fresh install
  - upgrade
  - idle resume
  - fresh agent bootstrap
  - dev continuity
  - learning continuity
  - research continuity
  - tool loop
  - scope isolation
- [x] 对 OpenClaw `2026.3.22` 与 `2026.3.23` 的兼容基线做文档化与测试参数化。
- [x] 把 playbook 中的 smoke test 命令与测试脚本实际行为对齐。

Run:

```bash
npm run test:openclaw-host
node test/plugin-manifest-regression.mjs
```

Expected:

- OpenClaw 集成矩阵覆盖 continuity 与 recovery，而不只覆盖基础 CLI 闭环。

## Phase 6: Benchmark Adapter and Release Gates

### Task 6.1: Replace fixture-only benchmarking with adapter-ready entrypoints

**Files:**
- Create: `scripts/bench/README.md`
- Create: `scripts/bench/run-fixture-bench.mjs`
- Create: `docs/benchmarks.md`
- Modify: `scripts/benchmark-fixture-runner.mjs`
- Modify: `package.json`
- Test: `test/benchmark-fixture-runner.test.mjs`

- [x] 先整理统一 bench 入口，区分：
  - repo fixture smoke
  - external benchmark adapter
  - release gate summary
- [x] 在 `docs/benchmarks.md` 中写明：
  - 数据集不在仓库时的接入方式
  - 指标字段
  - 回归判定规则
  - “整体正收益且无显著单项回退”的门槛定义
- [x] 保持 fixture runner 可本地直接运行，作为外部数据集不可用时的最小验证路径。

Run:

```bash
node --test test/benchmark-fixture-runner.test.mjs
node scripts/benchmark-fixture-runner.mjs --help
```

Expected:

- benchmark 路径从“只有测试夹具”升级为“可接真实 benchmark 的工程入口”。

## Phase 7: Full Verification and Release Checklist

### Task 7.1: Final integration sweep

**Files:**
- Modify: `package.json` if new scripts are needed
- Modify: `docs/plan/ongoing-optimization-assessment.md`
- Modify: `docs/plan/ongoing-optimization-implementation-plan.md`

- [x] 跑完整单测与回归：

```bash
npm test
npm run test:openclaw-host
```

- [x] 跑 OpenClaw 运维闭环：

```bash
openclaw config validate
openclaw plugins info memory-lancedb-pro
openclaw memory-pro doctor --json
openclaw memory-pro stats --json
```

- [x] 如果本地环境具备真实 embedding/rerank 服务，再追加真实 agent smoke：

```bash
openclaw agent --json
```

- [x] 回写文档中的“已完成/未完成”状态，避免计划文档和代码状态脱节。

Expected:

- 当前阶段所有最小目标可被重复验证。

## Out of Scope

以下内容不在本轮持续优化计划内：

- 重做为独立 context engine
- 引入第二套长期状态数据库
- 更改公开工具名或 `memory-pro` 主命令
- 为单个 benchmark 做牺牲整体稳定性的定制优化

## Suggested Commit Cadence

- `docs: add ongoing optimization assessment and plan`
- `feat: unify runtime inspection and rehydrate diagnostics`
- `feat: deepen continuity packet extraction`
- `feat: expand scenario routing with context-aware boosts`
- `feat: add agent-end usage feedback attribution`
- `test: extend openclaw continuity and recovery matrix`
- `docs: add benchmark gate documentation and scripts`
