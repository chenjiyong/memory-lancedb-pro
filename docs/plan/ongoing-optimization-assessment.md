# Memory-LanceDB-Pro 持续优化评估

## 1. 文档目的

这份文档用于回答三个问题：

1. 当前项目是否值得继续按照《提高撸棒性方案》推进优化。
2. 哪些部分已经落地，哪些部分仍然只是“可用版”而非“生产版”。
3. 后续优化时，哪些架构边界和 OpenClaw 集成约束必须保持不变。

对应的实施拆解见 [ongoing-optimization-implementation-plan.md](./ongoing-optimization-implementation-plan.md)。

## 2. 当前基线

### 2026-03-28 实施快照

- 已新增并接入：
  - `src/runtime-inspection.ts`
  - `test/runtime-rehydrate.test.mjs`
  - `test/dev-continuity-flow.test.mjs`
  - `test/learning-continuity-flow.test.mjs`
  - `test/research-continuity-flow.test.mjs`
  - `test/openclaw-runtime-matrix.mjs`
  - `test/openclaw-tool-loop-regression.mjs`
  - `test/openclaw-agent-bootstrap-check.test.mjs`
  - `docs/benchmarks.md`
  - `scripts/bench/run-fixture-bench.mjs`
  - `scripts/openclaw/check-agent-bootstrap.mjs`
- 已完成的 fresh verification：
  - `npm test`
  - `npm run test:openclaw-host`
- 当前默认环境 live verification 已通过：
  - `openclaw config validate` 在 `0.84s` 内返回
  - `openclaw plugins info memory-lancedb-pro` 在 `70.36s` 内返回 `Status: loaded`
  - `openclaw memory-pro doctor --json` 在 `87.84s` 内返回，`rehydrate=resume-existing/resume-ready`
  - `openclaw memory-pro stats --json` 在 `70.17s` 内返回
  - `openclaw agent --agent main --session-id phase7-live-check --message "只回复三个字：验证通过。" --json` 在 `8.88s` 内返回 `status=ok`
- 已确认的仓库侧修复仍然成立：插件 service `start()` 的 deferred timer / interval 保活问题已修复，`npm test` 与 `npm run test:openclaw-host` 均通过
- 2026-03-28 新增定位结果：
  - 单独复制 `~/.openclaw/openclaw.json` 到临时 HOME 即可复现“`20s` 探测阈值内不返回”，不需要复制 `memory/`、`agents/`、`workspace/` 等状态目录
  - 进一步减法验证显示：当 `plugins.allow` 只保留 `memory-lancedb-pro` 时，`openclaw plugins info memory-lancedb-pro` 可正常退出；当 `plugins.allow` 额外包含 bundled `telegram` 或 `discord` 时，同一命令会显著慢于 `20s` 阈值，但最终仍可返回
  - `doctor` 原先把缺少显式 `source` 字段、但已具备 `memory_category` 的新格式记忆误判为 legacy；该判定现已与 upgrader 对齐，因此 live `rehydrate` 已恢复为 `resume-ready`
  - `openclaw agent --json` 本轮验证前曾因 `openai-codex` refresh token 失效失败；重新登录后 smoke 已通过

### 已落地能力

- 已有 runtime health 和 rehydrate 模块：
  - `src/runtime-health.ts`
  - `src/runtime-rehydrate.ts`
- 已有 continuity packet、scenario router、usage feedback：
  - `src/continuity-packet.ts`
  - `src/scenario-router.ts`
  - `src/usage-feedback.ts`
- 已有 `memory-pro doctor` 自检入口：
  - `cli.ts`
- 已有 OpenClaw host functional 与 manifest regression：
  - `test/openclaw-host-functional.mjs`
  - `test/plugin-manifest-regression.mjs`
- 已有 OpenClaw 操作与回归说明：
  - `docs/openclaw-integration-playbook.md`

### 已确认的验证基线

- 仓库已有完整 `npm test` 套件。
- 仓库已有 `npm run test:openclaw-host`，覆盖：
  - `openclaw config validate`
  - `openclaw plugins info memory-lancedb-pro`
  - `openclaw memory-pro stats`
  - import / search / export / delete / migrate 闭环
- 当前架构已经明确保持：
  - OpenClaw `memory` slot 插件
  - LanceDB 单一主存储
  - 工具名与 CLI 名不变

## 3. 结论：要继续优化，但不重做架构

结论是：值得继续优化，但不应该再开一轮“推倒重来”式重构。

原因如下：

- 当前项目已经有正确的模块边界雏形，继续拆大改小的收益不高。
- 旧方案中最有价值的目标仍未完全完成，尤其是：
  - 启动期状态判定精度
  - continuity packet 的真实“继续工作”能力
  - recall 之后的实际使用反馈闭环
  - OpenClaw 侧的长期回归矩阵
  - benchmark 门槛的工程化
- 这些问题都可以在现有模块上继续加深，不需要再造第二套 session/context 系统。

## 4. 必须保持的架构边界

后续所有优化都必须遵守以下约束：

- 继续保持 OpenClaw `memory` slot 插件形态。
- 继续以 LanceDB 作为单一主存储。
- 不引入外部 context service。
- 不新增第二套长期状态源。
- `memory_recall`、`memory_store`、`memory_forget`、`memory_update` 语义保持兼容。
- `memory-pro` CLI 继续保持兼容，新增命令只能是增量增强。
- `index.ts` 继续作为 composition root，不把领域判断重新塞回主文件。
- continuity、scenario routing、runtime inspection、usage feedback 优先复用现有 reflection/sessionStrategy/session-recovery 路径。

## 5. 对照《提高撸棒性方案》的差距评估

### A. 运行时接管与恢复判定

现状：

- `src/runtime-inspection.ts` 已作为统一采集入口存在并接入仓库。
- 启动期 runtime health 与 `memory-pro doctor` 已共享 inspection / rehydrate 结果。
- `test/runtime-health.test.mjs`、`test/runtime-rehydrate.test.mjs`、`test/cli-smoke.mjs`、`test/openclaw-host-functional.mjs` 已覆盖这条链路。

仍有差距：

- 当前差距已不在 live 闭环是否通过，而在 OpenClaw `2026.3.14` 默认 profile 下的 one-shot CLI 返回延迟明显偏高。

影响：

- 仓库内与 live 环境的 runtime / rehydrate 结论已一致，但默认 live profile 的 CLI 交互时延仍会影响运维体验。

### B. 工作连续性

现状：

- continuity packet 已覆盖 dev / learning / research 三类提取路径。
- packet 已限制预算，且不会直接注入整段 reflection 原文。
- `test/dev-continuity-flow.test.mjs`、`test/learning-continuity-flow.test.mjs`、`test/research-continuity-flow.test.mjs`、`test/recall-text-cleanup.test.mjs` 已覆盖领域提取、注入顺序与预算。

仍有差距：

- 当前阶段没有新的 continuity 功能缺口；live smoke 已纳入通过。

影响：

- continuity 的仓库内行为与 live smoke 现在都已有通过记录。

### C. 场景化记忆路由

现状：

- 已有 `dev | learning | research | general` 路由。
- 已有 `artifact_kind` 级别的 boost。
- scenario router 已接入 `continuityText`、`projectKey`、`recentHintText` 上下文输入。
- `test/scenario-router.test.mjs` 已覆盖“同 query 不同上下文差异排序”和“boost 不 hard filter”。

仍有差距：

- 当前差距主要不在功能实现，而在长期运行下的性能与时延观测尚未工程化。

影响：

- 仓库内排序分布差异已有测试保证，且 live smoke 已计入通过。

### D. 记忆使用反馈闭环

现状：

- 已有 injected/confirmed-use 级别的 metadata patch。
- 已接入 `agent_end` 弱归因，覆盖 injected-but-unused、used-in-answer、used-in-action、stale suppression。
- `used_count`、`last_used_at`、`false_positive_recall_count`、`resume_effective_count` 已进入 metadata 兼容层。

仍有差距：

- 当前效果仍以仓库内单测为主，尚未扩展成长期线上观测指标。

影响：

- 使用反馈链路已有实现、测试和 live smoke 通过记录，但长期运行数据仍未沉淀为固定观测面板。

### E. OpenClaw 回归矩阵与 benchmark gate

现状：

- host functional 已覆盖核心 CLI/插件闭环。
- OpenClaw playbook 已存在。
- repo 内已有 benchmark fixture runner。
- `dev continuity` / `learning continuity` / `research continuity` 专项流程测试已建立。
- `scripts/bench/`、`scripts/bench/README.md`、`docs/benchmarks.md` 已建立。
- runtime / rehydrate 矩阵已补到 `test/openclaw-runtime-matrix.mjs`：
  - fresh install
  - workspace rehydrate
  - resume-ready
  - stale artifacts
  - migrate pending
- tool loop / scope isolation / `/new` session-summary 闭环已补到 `test/openclaw-tool-loop-regression.mjs`。
- fresh-agent bootstrap 文件预检查已补到 `scripts/openclaw/check-agent-bootstrap.mjs` 与对应测试。
- OpenClaw `2026.3.22` / `2026.3.23` 的 runtime health 兼容基线已通过参数化测试固定。

仍有差距：

- 真实 benchmark adapter 仍未接上 `MemoryAgentBench`、`LongMemEval`、`LoCoMo`、`Mem2ActBench`、`MemBench`。
- 默认 live profile 的 one-shot CLI 虽已闭环，但在 OpenClaw `2026.3.14` 下仍明显慢于 `20s` 探测阈值。

影响：

- 当前已具备仓库内 smoke、continuity、runtime matrix、bootstrap precheck、默认 live OpenClaw 验证与最小 benchmark gate；剩余未收敛项主要是外部 benchmark adapter 与 live CLI 时延。

## 6. OpenClaw 视角下的优化原则

后续优化必须先服务 OpenClaw 实际运行，再服务 abstract benchmark。

### 优先级排序

1. 插件能稳定被 OpenClaw 识别、加载、诊断、恢复。
2. 新 session 首轮能正确注入 continuity，而不是只堆更多 recall。
3. recall 的治理要看是否帮助回答和行动，而不是只看相似度分数。
4. benchmark 结果必须建立在 host functional 和真实 agent smoke 稳定的前提上。

### 必须维持稳定的 OpenClaw 交互面

- `plugins.allow`
- `plugins.load.paths`
- `plugins.slots.memory`
- `before_prompt_build`
- `command:new`
- `command:reset`
- `sessionStrategy`
- `memory-pro doctor`
- `memory-pro stats`

### 发布前固定检查

- `openclaw config validate`
- `openclaw plugins info memory-lancedb-pro`
- `openclaw hooks list --json`
- `openclaw memory-pro doctor --json`
- `openclaw memory-pro stats --json`
- `npm test`
- `npm run test:openclaw-host`

## 7. 推荐优化顺序

建议按以下顺序推进：

1. 先统一 runtime inspection 与 rehydrate 判定。
2. 再把 continuity packet 做深，优先解决开发场景连续性。
3. 然后增强 scenario routing，使其吃到上下文而不只吃 query。
4. 再补 usage feedback 的 `agent_end` 归因闭环。
5. 最后补齐 OpenClaw 专项回归矩阵和 benchmark adapter。

原因是：

- Phase 1 决定“插件是否稳定接管”。
- Phase 2 和 Phase 3 决定“session 是否真的连续”。
- Phase 4 决定“长期使用是否越用越稳”。
- Phase 5 决定“发布门槛是否可执行”。

## 8. 完成标准

当以下条件同时满足时，可认为持续优化阶段完成：

- OpenClaw 安装、升级、恢复路径有一致的状态分类与自检结论。
- 新 session 的首轮 continuity 注入能稳定表达“当前做什么、做到哪、下一步做什么”。
- `dev / learning / research` 三类上下文对同一 query 的召回分布明显不同，但不会硬过滤掉高价值记忆。
- recall 排名能吸收实际使用反馈，而不是只依赖相似度。
- OpenClaw host functional、continuity flows、benchmark adapter、发布门槛文档全部齐备。

## 9. 关联文档

- 旧方案归档：
  - [memory-lancedb-pro提高撸棒性方案.md](./archive/memory-lancedb-pro提高撸棒性方案.md)
- 当前已落地主方案：
  - [final-development-plan.md](./final-development-plan.md)
- OpenClaw 集成与回归操作：
  - [../openclaw-integration-playbook.md](../openclaw-integration-playbook.md)
- 后续实施拆解：
  - [ongoing-optimization-implementation-plan.md](./ongoing-optimization-implementation-plan.md)
