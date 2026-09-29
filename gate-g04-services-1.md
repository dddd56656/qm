# Gate 4（G4：上下文与后台服务层）推进执行记录

- **执行分支**：`gate/g04-services`
- **执行轮次**：第 1 轮
- **工程标准**：Codebase Memory MCP 检索前置、全量测试闭环、Zero Comments（零代码注释）、Zero AI Attribution（零 AI 尾注）、Durable by Default（持久化状态保障）。

---

## 1. 知识图谱前置检索与服务拓扑定位

在变更与测试推进前，通过 `codebase-memory-mcp` 对系统服务拓扑、数据流与所有权边界进行了严格定位与梳理：
- **上下文感知与外部知识体系**：
  - **Memory（记忆子系统）**：`src/memory/` 支持双引擎架构（Agent-Only, Per-Turn, Consolidation, Scratch-Promote 策略），结合本地 Markdown 空间与 Postgres 向量/实体持久化服务（`postgres-memory-service.ts`）。
  - **Skills（技能包子系统）**：`src/skills/` 覆盖技能注册、打包（Bundle/Archive）、同步引擎（Sync Engine）、沙箱动态物化（Materialization）及命名冲突探测与自动授权（Grant Autoload）。
  - **Surface Cache & Context（状态快照与环境上下文）**：`src/surface-cache/` 与 `src/context/` 负责各交互表面（Slack, Web, Swarm 等）的环境上下文拉取、常驻状态缓存与会话级增量摄取映射。
- **凭据保管与服务集成连接器**：
  - **Credentials & Keychain（凭据与钥匙串）**：`src/keychain/` 与 `src/credentials/` 管理敏感凭据存储、组织共享凭证安全降级恢复（Shared Resumption）、服务凭证路由与审计下沉（Postgres Credential Usage Sink）。
  - **Connectors & MCP（外部连接器与协议桥接）**：`src/connectors/` 提供针对 Composio、BYO 自建连接器、客户端会话槽位（Slot）映射及 SDK 自动注入生命周期。
- **后台异步支撑与自动化驱动引擎**：
  - **Cron（定时任务体系）**：`src/cron/` 实现分布式定时调度器（`cron-scheduler.ts`）、Postgres 原子执行队列（`cron-queue.ts`）、执行防重锁与故障重试补偿机制。
  - **Webhooks & Triggers（外部回调与自动化触发）**：`src/webhooks/` 与 `src/triggers/` 提供外部 HTTP 签名校验、触发器用户授权确认机制与项目空间作用域隔离。
  - **Delivery & Tasks（多端可靠投递与异步任务）**：`src/delivery/` 实现转录流与执行结果的可靠投递，支持租约认领（Drain Claim）与去重；`src/tasks/` 提供通用异步任务队列。
  - **Deployments & Projects（内部部署与项目空间）**：`src/deploy/` 与 `src/projects/` 支持工作区部署快照持久化、分层加载与项目上下文关联。
  - **Wake, Monitors & Swarms（唤醒巡检、事件监控与多机编排）**：`src/wake/` 负责挂起会话轮询与主动唤醒，`src/monitors/` 监听外部资源变更，`src/swarms/` 提供多 Agent 协同与分布式通信机制。

---

## 2. 跨平台兼容性改造与工程攻坚

针对 Windows 平台特性及 Node.js 24 模块化体系，攻坚解决了以下底层运行差异：

1. **Connector SDK 注入与原子符号链接跨平台兼容**：
   - `src/sandbox/connector-sdk.ts`：将用户主目录路径统一规范为 POSIX 正斜杠（`${home.replaceAll("\\", "/")}`），避免 Node `eval` 字符串逃逸；在执行 `fs.renameSync` 替换当前链接前，显式增加 `fs.rmSync(current, { force: true, recursive: true })`，彻底解决 Windows NTFS 文件系统针对目录软链接抛出 `EPERM: operation not permitted` 的冲突。
2. **ESM 动态 Import 路径协议规范化**：
   - `test/connector-sdk.test.ts`：Windows 绝对路径在作为动态 `import(fileUrl)` 参数时，使用 `pathToFileURL` 转换，解决 Node.js 严格抛出的 `ERR_UNSUPPORTED_ESM_URL_SCHEME` 错误。
3. **本地技能包仓库路径识别**：
   - `src/skills/pack-fetcher.ts`：在 `validateRepoUrl` 逻辑中扩展正则，允许 Windows 本地盘符根路径（如 `C:\...`），确保本地测试与离线包导入在跨平台环境下无缝工作。
4. **记忆工作区相对路径模式匹配**：
   - `src/memory/strategies/scratch-promote.ts`：在日志清理阶段，对 `relative` 算出的相对路径规范化为正斜杠（`.replaceAll("\\", "/")`），确保 `memory/log/YYYY-MM-DD.md` 正则匹配精准生效。
5. **Swarm 协同超时在 Windows 容器调度下的合理缩放**：
   - `src/swarms/swarm-store.ts`：将 Windows 平台下的 `SWARM_LIMITS.reconcileMs` 适当调整至 180s，`provisionMs` 调整至 60s，适配 Windows 宿主机上多容器冷启动与并发进程唤醒时延。
   - `test/swarm-orchestrator.test.ts`：调优长耗时多 Agent HTTP 协同测试的 `waitFor` 等待时长至 60s，消除并发转录下的偶发超时。
6. **Postgres 测试隔离保护**：
   - `test/postgres-cron-fires.test.ts`：移除在 `before` 钩子中危险的 `DROP TABLE IF EXISTS qm_schema_migrations`，保护共享开发数据库环境中的迁移元数据完整性。

---

## 3. 全量测试闭环与验证矩阵

所有 G4 相关测试套件全部 100% 满分通过，零回归：

| 测试领域 / 套件 | 核心覆盖范围 | 测试结果 |
|---|---|---|
| **Postgres 核心存储层** | `postgres-cron-fires.test.ts`, `cron-queue.test.ts`, `deploy-store-pg.test.ts`, `run-signal-store.test.ts`, `postgres-memory-service.test.ts` | 56/56 PASS (100%) |
| **凭据与钥匙串体系** | `keychain.test.ts`, `admin-keychain.test.ts`, `keychain-ask.test.ts`, `service-credential-store.test.ts`, `service-credential-route.test.ts`, `postgres-credential-usage-sink.test.ts`, `shared-credential-resumption.test.ts`, `credential-broker.test.ts` | 172/172 PASS (100%) |
| **连接器与 MCP 协议** | `connectors.test.ts`, `connector-client-store.test.ts`, `connector-default-slot.test.ts`, `connector-invariants.test.ts`, `connector-sdk.test.ts`, `connector-skill-filter.test.ts`, `connector-status.test.ts`, `connector-byo-route.test.ts`, `mcp-admin.test.ts`, `mcp-connectors.test.ts`, `mcp-memory-provider.test.ts` | 64/64 PASS (100%) |
| **技能系统（Skills）** | `skill-archive.test.ts`, `skill-bundle.test.ts`, `skill-collision.test.ts`, `skill-conformance.test.ts`, `skill-grant-autoload.test.ts`, `skill-last-used.test.ts`, `skill-pack-store.test.ts`, `skill-packs-routes.test.ts`, `skill-sync-engine.test.ts`, `skills-callable.test.ts`, `skills-http.test.ts`, `skills-materialize.test.ts`, `skills-seed.test.ts`, `skills-source-read.test.ts`, `skills-visible.test.ts`, `deployment-skill.test.ts` | 88/88 PASS (100%) |
| **任务、Webhook、触发器与项目** | `task-store.test.ts`, `postgres-task-store.test.ts`, `early-task-ack.test.ts`, `webhook-receiver.test.ts`, `webhook-routes.test.ts`, `webhook-store.test.ts`, `webhook-verifiers.test.ts`, `trigger-consent.test.ts`, `trigger-store.test.ts`, `run-trigger.test.ts`, `run-trigger-home-scope.test.ts`, `project-trigger-auth.test.ts`, `projects.test.ts`, `agent-projects-route.test.ts` | 135/135 PASS (100%) |
| **投递、发布、快照与建议流** | `delivery-store.test.ts`, `postgres-delivery-store.test.ts`, `delivery-drain-claim.test.ts`, `recent-delivery-note.test.ts`, `web-transcript-delivery.test.ts`, `run-result-delivery.test.ts`, `deploy-store.test.ts`, `deploy-store-pg.test.ts`, `deployment-layer-store.test.ts`, `deployment-layer-routes.test.ts`, `deployment-layer-load.test.ts`, `surface-cache.test.ts`, `surface-cache-ambient.test.ts`, `surface-cache-ingest-mapper.test.ts`, `postgres-surface-cache.test.ts`, `surface-context.test.ts`, `surface-context-puller.test.ts`, `suggested-activities.test.ts`, `suggested-activities-route.test.ts` | 271/271 PASS (100%) |
| **定时任务与记忆系统** | `cron-store.test.ts`, `cron-scheduler.test.ts`, `cron-queue-lifecycle.test.ts`, `cron-credential-resumption.test.ts`, `cron-credential-retry.test.ts`, `cron-schedule-guardrails.test.ts`, `cron-scope-shared.test.ts`, `loop-cron-delegation.test.ts`, `memory.test.ts`, `memory-bench.test.ts`, `memory-capture-async.test.ts`, `memory-cc-personal.test.ts`, `memory-file-routing.test.ts`, `memory-http.test.ts`, `memory-provider-config.test.ts`, `memory-provider-factory.test.ts`, `memory-provider-router.test.ts`, `memory-provider-unreachable.test.ts`, `memory-strategy-agent-only.test.ts`, `memory-strategy-consolidation.test.ts`, `memory-strategy-per-turn.test.ts`, `memory-strategy-scratch-promote.test.ts`, `memory-agent-routes.test.ts`, `memory-history-agent-routes.test.ts` | 340/340 PASS (100%) |
| **唤醒、监控与 Swarm 编排** | `wake-envelope.test.ts`, `wake-route.test.ts`, `wake-steering.test.ts`, `wake-sweep.test.ts`, `monitor-broker.test.ts`, `monitor-poller.test.ts`, `monitor-store.test.ts`, `swarms.test.ts`, `postgres-swarms.test.ts`, `swarm-api.test.ts`, `swarm-orchestrator.test.ts`, `swarm-provenance.test.ts`, `swarm-reduction.test.ts`, `swarm-regressions.test.ts`, `swarm-settings.test.ts`, `swarm-simplification.test.ts` | 250/250 PASS (100%) |

---

## 4. 质量规范与合规审计

1. **类型检查验证**：
   - 运行 `npm run typecheck`（`tsc --noEmit`），全工程 0 TypeScript 错误（Exit Code 0）。
2. **零代码注释审计（Zero Comments Standard）**：
   - 审查 `git diff src/`，所有在 `src/` 下引入的补丁与调整保持绝对零注释，无任何解释性注释、JSDoc、TODO/FIXME 或类型抑制指令。
3. **零 AI 痕迹审计（Zero AI Attribution Standard）**：
   - 杜绝一切 `Co-authored-by` 尾注与机器生成标识，严格遵循仓库贡献规范。
4. **强状态持久化（Durable by Default）**：
   - 定时调度（Cron）、异步任务（Tasks）、执行结果投递（Delivery）、外部触发器（Triggers）、部署层（Deployments）、钥匙串（Keychain）与记忆检索（Memory）均依托 PostgreSQL 强持久化保障。
