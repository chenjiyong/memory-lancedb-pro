# OpenClaw 记忆功能客观对比表

## 观察范围

- 对比对象：
  - 当前项目 `memory-lancedb-pro`
  - `OpenViking` 的 `examples/openclaw-plugin`
- 对比口径：
  - 只看 `OpenClaw` 实际记忆使用场景
  - 优先保留对后续 `memory-lancedb-pro` 迭代开发更有区分度的维度
- 当前项目已包含 `PR #311` 合并后的代码：
  - `cross-process file lock + CLAWTEAM_MEMORY_SCOPE`

## 客观对比表

| ID | 维度 | `memory-lancedb-pro` 当前状态 | `OpenViking` 当前状态 | 当前差异的客观含义 |
|---|---|---|---|---|
| C1 | OpenClaw 接入形态 | 原生 `memory` 插件 | `context-engine` 插件 | 当前项目更贴近 OpenClaw 原生记忆插件模型；OpenViking 仍是外接上下文引擎形态。 |
| C2 | 三层记忆 | 有，L0/L1/L2 在单条记忆的 `metadata` 中 | 有，`abstract / overview / content` 属于上下文对象模型 | 两边都有三层记忆，差异不在“有没有”，而在承载方式。 |
| C3 | 记忆主数据面 | LanceDB 单表，核心字段加 `metadata` 扩展 | `viking://` 对象 / 文件系统 + 服务端检索 | 当前项目实现更集中，OpenViking 模型更大。 |
| C4 | 自动写入入口 | `agent_end` | `afterTurn` | 两边都支持自动捕获，但挂接点不同。 |
| C5 | 自动召回入口 | `before_agent_start` | `before_prompt_build` | 两边都在 prompt 前注入，但集成路径不同。 |
| C6 | 默认注入内容 | 以 L0 摘要为主 | 优先读取 L2 正文，失败退回 abstract | 当前项目默认注入负载更轻；OpenViking 默认注入内容更长。 |
| C7 | 检索形态 | vector / BM25 / hybrid / rerank / MMR 都在插件内 | 服务端语义检索 + hotness，插件侧再做二次筛选 | 当前项目检索逻辑更集中在 OpenClaw 插件侧。 |
| C8 | 去重决策粒度 | `merge / support / contextualize / contradict / supersede` | 以 `skip / create / merge / delete` 为主 | 当前项目对“新增、补充、上下文化、冲突、替代”区分更细。 |
| C9 | 旧事实版本化 | 有显式 `supersede` 链 | 本轮未查到等价 supersede 链 | 当前项目对“新旧事实共存但旧事实失效”的表达更明确。 |
| C10 | OpenClaw 工具面 | `memory_recall/store/forget/update` + `stats/list/promote/archive/compact/explain_rank` + `self_improvement_*` | 当前示例插件只见 `memory_recall/store/forget` | 当前项目在 OpenClaw 内暴露的记忆管理面更完整。 |
| C11 | OpenClaw CLI 运维面 | 有 `openclaw memory-pro list/search/stats/delete/export/import/reembed/upgrade/migrate` | 本轮未查到等价的 OpenClaw 侧运维 CLI | 当前项目更适合直接在 OpenClaw 本地环境里做运维和迁移。 |
| C12 | 闭环验证文档 | 有 OpenClaw 集成闭环和验证清单 | OpenViking OpenClaw 接入仍保留部分 future hook / design item | 当前项目当前形态更偏“可直接落地验证”的插件。 |
| C13 | 记忆治理状态 | 有 `pending / confirmed / archived`、`memory_layer`、`bad_recall_count`、`suppressed_until_turn` | 本轮未在 OpenClaw 插件层查到等价治理字段 | 当前项目把 recall 治理显式编码在记忆元数据中。 |
| C14 | 人工确认 / 晋升 | 有 `memory_promote` | 本轮未查到等价 OpenClaw 工具 | 当前项目支持把记忆从工作态推进到确认态。 |
| C15 | 人工归档 / 压缩 | 有 `memory_archive`、`memory_compact` | 本轮未查到等价 OpenClaw 工具 | 当前项目支持长期运行后的本地记忆整理。 |
| C16 | 排名可解释性 | 有 `memory_explain_rank` | 本轮未查到等价 OpenClaw 工具 | 当前项目更容易直接解释“为什么这条被召回”。 |
| C17 | Admission control | 写入前可做 admission 判断 | 本轮未查到 OpenClaw 插件层等价 admission reject 审计链 | 当前项目把“是否允许进入长期记忆”做成显式治理环节。 |
| C18 | 拒绝审计 | admission reject 可写 durable audit | 本轮未查到等价实现 | 当前项目保留了“为什么没写入”的审计面。 |
| C19 | Workspace / USER.md 边界 | 有 USER.md-exclusive 路由与 recall 过滤 | 本轮未查到等价机制 | 当前项目显式处理了 OpenClaw workspace 文档与记忆库的边界。 |
| C20 | 技能沉淀方式 | 有 `self_improvement_extract_skill`，把 learning/记忆提炼成 `skills/<name>/SKILL.md` | skills 是一等对象，但本轮未查到 OpenClaw 插件层等价“记忆 -> skill scaffold”闭环 | 当前项目更偏“记忆沉淀技能”；OpenViking 更偏“技能本身就是上下文对象”。 |
| C21 | 资源管理 | 未做独立资源树 | 资源导入、增量更新、watch、AGFS 资源树都较完整 | OpenViking 资源面更强，但对 OpenClaw 记忆主链路的直接相关性较低。 |
| C22 | 多 Agent 默认模型 | 默认仍是 scope 隔离，不是默认共写一池 | 默认也是 `user / agent` 空间隔离 | 这项不是两边在 OpenClaw 场景里的主要分歧点。 |
| C23 | ClawTeam 适配 | 有 `CLAWTEAM_MEMORY_SCOPE` | 本轮未查到 `ClawTeam` 专用接入点 | 当前项目已出现面向本地 swarm 共享 scope 的直接适配。 |
| C24 | ClawTeam 默认写入行为 | 即使扩展了 team scope，默认写入目标仍是 agent 私有 scope | 本轮未核到等价机制 | 当前项目没有把“共享 scope”变成默认共写。 |
| C25 | ClawTeam 并发写安全 | 有跨进程写锁，且有并发测试 | 本轮未找到当前 OpenClaw 接入里的等价本地 swarm 写入适配 | 当前项目已显式处理多个本地 worker 共用一个记忆库的写安全问题。 |

## 按迭代开发更相关的差异归类

### 1. OpenClaw 原生使用面

| 类别 | `memory-lancedb-pro` 当前状态 | `OpenViking` 当前状态 |
|---|---|---|
| 插件定位 | 原生 memory 插件 | context-engine 外挂 |
| OpenClaw 工具闭环 | 完整 | 简化 |
| OpenClaw CLI 运维 | 完整 | 本轮未见等价入口 |
| 调试 / 排障 | 有 `memory_explain_rank`、stats、list | 主要依赖服务端和插件日志 |

### 2. 记忆治理与生命周期

| 类别 | `memory-lancedb-pro` 当前状态 | `OpenViking` 当前状态 |
|---|---|---|
| 记忆状态 | `pending / confirmed / archived` | 本轮未见插件层等价状态机 |
| 抑制与坏召回治理 | `bad_recall_count`、`suppressed_until_turn` | 本轮未见插件层等价字段 |
| 事实替代 | 显式 supersede | merge/delete 为主 |
| Admission control | 有 | 本轮未见插件层等价链 |

### 3. OpenClaw 本地协同

| 类别 | `memory-lancedb-pro` 当前状态 | `OpenViking` 当前状态 |
|---|---|---|
| USER.md / workspace 边界 | 有显式边界逻辑 | 本轮未见等价机制 |
| 技能沉淀 | 从 learning 提炼 skill scaffold | skills 本身是一等对象 |
| ClawTeam 共享 scope | 有 | 本轮未见直接适配 |
| ClawTeam 并发写安全 | 有 | 本轮未见当前接入里的等价证据 |

## 代码证据

### C1-C3 接入形态与三层记忆

- 当前项目插件类型：`kind: "memory"`
  - [/Users/chenjiyong/learning/memory-lancedb-pro/index.ts](/Users/chenjiyong/learning/memory-lancedb-pro/index.ts#L1662)
- OpenViking 插件类型：`kind: "context-engine"`
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts#L74)
- 当前项目三层字段：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-metadata.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-metadata.ts#L38)
- OpenViking 三层结构：
  - [/Users/chenjiyong/learning/OpenViking/openviking/session/memory_extractor.py](/Users/chenjiyong/learning/OpenViking/openviking/session/memory_extractor.py#L58)

### C4-C6 自动写入、自动召回、注入形态

- 当前项目自动写入：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/index.ts](/Users/chenjiyong/learning/memory-lancedb-pro/index.ts#L2381)
- 当前项目自动召回：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/index.ts](/Users/chenjiyong/learning/memory-lancedb-pro/index.ts#L2131)
- OpenViking `afterTurn`：
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/context-engine.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/context-engine.ts#L183)
- OpenViking 自动注入优先读 L2：
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts#L497)

### C7-C9 检索、去重、版本化

- 当前项目检索：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/retriever.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/retriever.ts#L380)
- 当前项目 admission + dedup：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts#L463)
- 当前项目 supersede：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts#L932)
- OpenViking 检索混合 hotness：
  - [/Users/chenjiyong/learning/OpenViking/openviking/retrieve/hierarchical_retriever.py](/Users/chenjiyong/learning/OpenViking/openviking/retrieve/hierarchical_retriever.py#L507)
- OpenViking dedup 决策类型：
  - [/Users/chenjiyong/learning/OpenViking/openviking/session/memory_deduplicator.py](/Users/chenjiyong/learning/OpenViking/openviking/session/memory_deduplicator.py#L30)

### C10-C12 工具、CLI、闭环文档

- 当前项目工具注册总入口：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L1907)
- 当前项目 `memory-pro` CLI：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/README_CN.md](/Users/chenjiyong/learning/memory-lancedb-pro/README_CN.md#L570)
- 当前项目 OpenClaw 闭环验证清单：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/docs/openclaw-integration-playbook.zh-CN.md](/Users/chenjiyong/learning/memory-lancedb-pro/docs/openclaw-integration-playbook.zh-CN.md#L195)
- OpenViking 示例插件工具：
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts#L131)
- OpenViking 设计文档保留项：
  - [/Users/chenjiyong/learning/OpenViking/docs/design/openclaw-integration.md](/Users/chenjiyong/learning/OpenViking/docs/design/openclaw-integration.md#L13)
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts#L566)

### C13-C19 治理、归档、解释、workspace 边界

- 治理元数据：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-metadata.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-metadata.ts#L29)
- `memory_promote`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L1528)
- `memory_archive`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L1644)
- `memory_compact`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L1725)
- `memory_explain_rank`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L1823)
- USER.md-exclusive 边界：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/workspace-boundary.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/workspace-boundary.ts#L44)

### C17-C20 Admission 与技能沉淀

- Admission reject 与审计：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts#L463)
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/smart-extractor.ts#L1243)
- `self_improvement_extract_skill`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/tools.ts#L314)
- README 中 9 个 MCP 工具和 self-improvement 说明：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/README_CN.md](/Users/chenjiyong/learning/memory-lancedb-pro/README_CN.md#L224)

### C21-C25 资源、ClawTeam、多 Agent

- OpenViking 资源管理：
  - [/Users/chenjiyong/learning/OpenViking/docs/en/api/02-resources.md](/Users/chenjiyong/learning/OpenViking/docs/en/api/02-resources.md#L3)
- OpenViking OpenClaw 自动召回默认检索 memories：
  - [/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts](/Users/chenjiyong/learning/OpenViking/examples/openclaw-plugin/index.ts#L464)
- 当前项目默认 agent 私有 scope：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/scopes.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/scopes.ts#L203)
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/scopes.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/scopes.ts#L230)
- `CLAWTEAM_MEMORY_SCOPE`：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/clawteam-scope.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/clawteam-scope.ts#L1)
  - [/Users/chenjiyong/learning/memory-lancedb-pro/index.ts](/Users/chenjiyong/learning/memory-lancedb-pro/index.ts#L1719)
- 跨进程写锁：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/store.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/store.ts#L55)
  - [/Users/chenjiyong/learning/memory-lancedb-pro/src/store.ts](/Users/chenjiyong/learning/memory-lancedb-pro/src/store.ts#L205)
- 并发写测试：
  - [/Users/chenjiyong/learning/memory-lancedb-pro/test/cross-process-lock.test.mjs](/Users/chenjiyong/learning/memory-lancedb-pro/test/cross-process-lock.test.mjs#L53)

## 未纳入已验证结论的项

- `A2A` 迁移方式：本轮未在这两个项目和本地 `OpenClaw` 资料中核到可直接作为“记忆迁移主方案”的实现证据。
- “跨设备共享是为了收费”：本轮未核到代码或文档证据。
