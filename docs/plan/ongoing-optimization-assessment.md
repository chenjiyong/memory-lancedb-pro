# Memory-LanceDB-Pro 持续优化评估

## 1. 文档目的

这份文档用于回答三个问题：

1. 当前项目是否值得继续按照《提高撸棒性方案》推进优化。
2. 哪些部分已经落地，哪些部分仍然只是“可用版”而非“生产版”。
3. 后续优化时，哪些架构边界和 OpenClaw 集成约束必须保持不变。

对应的实施拆解见 [ongoing-optimization-implementation-plan.md](./ongoing-optimization-implementation-plan.md)。

## 2. 当前基线

### 2026-03-27 实施快照

- 已新增并接入：
  - `src/runtime-inspection.ts`
  - `test/runtime-rehydrate.test.mjs`
  - `test/dev-continuity-flow.test.mjs`
  - `test/learning-continuity-flow.test.mjs`
  - `test/research-continuity-flow.test.mjs`
  - `docs/benchmarks.md`
  - `scripts/bench/run-fixture-bench.mjs`
- 已完成的 fresh verification：
  - `npm test`
  - `npm run test:openclaw-host`
- 当前剩余风险不是仓库内回归，而是 live OpenClaw profile 的命令级响应：
  - `openclaw config validate` 可正常返回
  - `openclaw plugins info memory-lancedb-pro`、`openclaw memory-pro doctor --json`、`openclaw memory-pro stats --json` 在打印插件启动日志后未在 20 秒内退出，因此不能计为 live 运维闭环已通过
  - 已确认的仓库侧修复仍然成立：插件 service `start()` 的 deferred timer / interval 保活问题已修复，`npm test` 与 `npm run test:openclaw-host` 均通过
  - 2026-03-27 新增定位结果：单独复制 `~/.openclaw/openclaw.json` 到临时 HOME 即可复现卡住，不需要复制 `memory/`、`agents/`、`workspace/` 等状态目录
  - 进一步减法验证显示：当 `plugins.allow` 只保留 `memory-lancedb-pro` 时，`openclaw plugins info memory-lancedb-pro` 可正常退出；当 `plugins.allow` 额外包含 bundled `telegram` 或 `discord` 时，同一命令会再次超时
  - 因此当前未通过的 live CLI 问题，边界已收敛到 OpenClaw `2026.3.14` 下的多插件 allowlist / one-shot CLI 行为，而不是本仓库 memory 插件单独保活

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

- 启动期已经会生成 runtime health 日志。
- `memory-pro doctor` 已能输出 health + rehydrate 摘要。

仍有差距：

- 启动路径与 `doctor` 使用的数据来源还不完全一致。
- 启动期的 `memoryCount`、`reflectionArtifactCount`、`hasLegacyArtifacts` 仍存在简化推断。
- `migrate pending`、`stale artifacts` 这类状态还没有形成统一分类术语。

影响：

- OpenClaw fresh install / later install / idle resume / upgrade 这几类路径的日志与恢复动作还不够稳定。

### B. 工作连续性

现状：

- continuity packet 已存在。
- packet 已限制预算，且不会直接注入整段 reflection 原文。

仍有差距：

- 当前更像“摘要包”，还不是“继续工作包”。
- 对开发场景，缺少稳定提取：
  - 当前模块/文件
  - 已完成 / 未完成
  - 失败点与规避方式
  - 常用命令、工具、skills
- 对学习和研究场景，缺少面向知识缺口、证据来源、待验证问题的专门提取。

影响：

- 新 session 能想起“相关内容”，但未必能直接“继续做事”。

### C. 场景化记忆路由

现状：

- 已有 `dev | learning | research | general` 路由。
- 已有 `artifact_kind` 级别的 boost。

仍有差距：

- 当前路由主要依赖 query 正则匹配。
- 尚未充分接入 session context、workspace/project key、recent continuity packet。
- metadata 写入路径还没有系统性地产生 learning / research 专用信号。

影响：

- 同一 query 在不同上下文下的召回差异还不够稳定。

### D. 记忆使用反馈闭环

现状：

- 已有 injected/confirmed-use 级别的 metadata patch。
- 已能对 stale injection 做一定抑制。

仍有差距：

- 还没有 `agent_end` 后的实际使用归因。
- 缺少“被注入但未帮助回答”和“被注入且帮助完成动作”的稳定区分。
- 与 rerank / governance / compactor 的长期联动仍偏轻量。

影响：

- recall 排名还是更接近“像不像”，而不是“是否真的帮助了任务继续”。

### E. OpenClaw 回归矩阵与 benchmark gate

现状：

- host functional 已覆盖核心 CLI/插件闭环。
- OpenClaw playbook 已存在。
- repo 内已有 benchmark fixture runner。

仍有差距：

- `dev continuity` / `learning continuity` / `research continuity` 专项流程测试尚未建立。
- `scripts/bench/` 与 `docs/benchmarks.md` 尚未建立。
- 真实 benchmark adapter 仍未接上 `MemoryAgentBench`、`LongMemEval`、`LoCoMo`、`Mem2ActBench`、`MemBench`。

影响：

- 当前能做仓库内烟测，但还不能把“整体正收益”收敛成发布门槛。

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
