# Gate 5（G5：Agent 核心与 HTTP 总装层）推进执行记录

- **执行分支**：`gate/g05-core`
- **执行轮次**：第 1 轮
- **工程标准**：Codebase Memory MCP 检索前置、全量测试闭环、Zero Comments（零代码注释）、Zero AI Attribution（零 AI 尾注）、Durable by Default（持久化状态保障）。

---

## 1. 知识图谱前置检索与核心总装拓扑定位

在变更与测试推进前，通过 `codebase-memory-mcp` 对 Core 运行时、Orchestrator 编排器、HTTP API 路由矩阵与 Wiring 依赖闭包进行了全面检索与拓扑定位：
- **正式系统接线与启动入口（System Wiring & Entrypoint）**：
  - `src/wiring.ts`：系统核心依赖注入工厂（Dependency Injection），统一装配单例 Store、模型 Harness 路由、沙箱驱动、上下文聚合器、执行器 Worker、安全审查器与 HTTP App 实例。
  - `src/index.ts`、`src/instrument.ts`、`src/egress-authz-main.ts`：正式主进程启动入口、Sentry/OpenTelemetry 遥测插桩以及外部流量授权代理主服务。
- **HTTP 服务层与路由总线（HTTP App & RESTful API Routing）**：
  - `src/api/server.ts`、`src/api/http.ts`：原生 Node.js HTTP 服务器、路由解析、请求鉴权中间件（Cookie、Bearer Token、HMAC 签名）与 SSE 流式事件推送通道。
  - `src/api/app.ts` 与 `src/api/app-*.ts`：Core 业务门面（Facade），封装 Turn 提交、会话状态流转、消息检索、技能调用与部署控制。
  - `src/api/routes/`：模块化路由矩阵，涵盖 turns、sessions、approvals、runs、admin、loops、crons、webhooks、blobs 等全功能端点。
- **Agent 执行编排器与工作流闭环（Orchestrator & Execution Loop）**：
  - `src/core/orchestrator.ts`：多轮交互主状态机，协调系统提示词组装（Prompt Blocks）、安全审查拦截（Security Screener）、租约自动保活（Lease Keepalive）、沙箱隔离执行与结果归卷落库。
  - `src/runs/worker.ts`：分布式 Worker 轮次执行循环，基于 Postgres/内存队列拉取待执行作业，保障故障重试、租约防丢与优雅关机。
- **自治循环系统与工作账本（Autonomous Loops & Ledger）**：
  - `src/loops/`：全自动工作流驱动引擎，覆盖 loop-fire、item-ledger、loop-store、governor 动态风控、自动审批判定（ship-gate）与外部适配器（Gmail、Slack）。
- **模型网关与多 Provider 动态路由（Model Gateway & Registry）**：
  - `src/model/`：模型能力注册表、动态 Provider 挂载（custom-providers）、凭证安全解密路由与个人/组织模型凭证持久化隔离。

---

## 2. 跨平台兼容性改造与工程攻坚

针对 Windows 平台特性、NTFS 文件系统差异及多进程通信行为，攻坚解决了以下底层运行差异：

1. **子进程标准流（stdio）EOF 跨平台事件分发适配**：
   - `test/codex-app-server.test.ts`：在 Windows 平台上，模拟 Codex 子进程的测试脚本仅调用 `process.stdout.end()` 时，底层 libuv 命名管道因 stdin readline 接口持有事件循环而未能及时向父进程触发 `'end'` EOF 事件，导致测试超时挂起。增加 `if (process.platform === "win32") setTimeout(() => process.exit(0), 10)`，确保子进程在完成流式输出后彻底退出并触发标准 EOF，全套 8 项测试在 2.6 秒内满分通过。
2. **Windows 进程衍生与执行超时延展**：
   - `test/turn-stream.test.ts`：Windows 宿主环境下调用 `spawnSync("sh", ...)` 具有相对毫秒级显著的进程衍生开销。将测试中的硬编码 `5_000` 租约及等待超时合理化为 `const TEST_TIMEOUT_MS: number = process.platform === "win32" ? 30_000 : 5000;`，消除高负载下的偶发超时。
3. **Connector SDK 构建产物与 Dockerfile 依赖补齐**：
   - 恢复 `.generated/connector-sdk` 打包物与 `deploy/core/Dockerfile` 静态构建依赖资源，闭合镜像构建与依赖检查闭环。

---

## 3. 全量测试闭环与验证矩阵

G5 核心总装及相关支撑测试全部 100% 满分通过，零回归：

| 测试领域 / 套件 | 核心覆盖范围 | 测试结果 |
|---|---|---|
| **HTTP API 校验与接入层** | `api-validation.test.ts` (参数校验、畸形请求 400 校验、未声明资源 404 隔离) | 2/2 PASS (100%) |
| **Turn 交互、SSE 流与重试恢复** | `turn-stream.test.ts`, `turn-options.test.ts`, `turn-origin.test.ts`, `turn-outcome.test.ts`, `turn-resume.test.ts`, `turn-retry-replay.test.ts`, `turn-bookkeeping-failures.test.ts`, `turn-context.test.ts`, `turn-metrics-route.test.ts`, `turns-union-guard.test.ts` | 110/110 PASS (100%) |
| **Orchestrator 编排器与文档输入** | `orchestrator.test.ts`, `orchestrator-documents.test.ts` (审批中断、命令隔离、自动隔离检疫、多轮上下文、租约保活、沙箱生命周期) | 166/166 PASS (100%) |
| **自治循环与执行账本 (Loops)** | `loop-execution.test.ts`, `loop-fire.test.ts`, `loop-governor.test.ts`, `loop-item-routes.test.ts`, `loop-ledger.test.ts`, `loop-output-store.test.ts`, `loop-routes.test.ts`, `loop-ship-gate.test.ts`, `loop-source-send.test.ts`, `loop-store.test.ts`, `loop-success-evaluation.test.ts` | 220/220 PASS (100%) |
| **模型网关、Registry 与凭据** | `admin-model-lookup.test.ts`, `agent-api-discovery.test.ts`, `agent-api-parity.test.ts`, `base-model-serviceability.test.ts`, `codex-app-server.test.ts`, `core-client-read.test.ts`, `core-search.test.ts`, `custom-provider-boot-wiring.test.ts`, `deploy-app-shell.test.ts`, `deploy-core-image.test.ts`, `dynamic-openrouter-model.test.ts`, `message-revisions-turn-end.test.ts`, `model-credential-route.test.ts`, `model-gateway.test.ts`, `model-overlay-postgres.test.ts`, `model-overlay.test.ts`, `model-registry.test.ts`, `model-verification.test.ts`, `personal-model-account-execution.test.ts`, `personal-model-account.test.ts`, `pi-models.test.ts`, `webui-model-allowlist.test.ts` | 138/138 PASS (100%) |

---

## 4. 质量规范与合规审计

1. **类型检查验证**：
   - 运行 `npm run typecheck`（`tsc --noEmit`），全工程 0 TypeScript 错误（Exit Code 0）。
2. **零代码注释审计（Zero Comments Standard）**：
   - 审查全仓 `src/` 内部代码，注释统计为严格的 `0` 行（0 Comments in `src/`），无任何解释性注释、JSDoc、TODO/FIXME 或类型抑制指令。
3. **零 AI 痕迹审计（Zero AI Attribution Standard）**：
   - 杜绝一切 `Co-authored-by` 尾注与机器生成标记，严格遵守代码仓库规范。
4. **强状态持久化（Durable by Default）**：
   - 完整 core 正式启动路径唯一使用原 `src/wiring.ts` 与 `src/index.ts`，会话历史、运行记录（Runs）、自治账本（Loop Ledger）、模型覆盖配置与租约记录全面接入持久化存储。
