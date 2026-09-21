# G2 阶段总结与后续执行指引 (G2_SUMMARY.md)

> **当前阶段状态**：`G2` (身份、作用域与状态底座) **已验收通过 (PASS)**  
> **分支与标签**：分支 `gate/g02-foundation`，通过标签 `gate/g02-pass`  
> **前置基线**：已通过 `git merge --ff-only gate/g01-pass` 完整接入 G1 拆解地图与装配拓扑  
> **状态与存储**：真实 PostgreSQL 容器 (`qm-dev-postgres` @ `127.0.0.1:55432`) 联调就绪，155 项 migrations 迁移记录完整入库，136 张核心表就绪  
> **测试成果**：28 个核心底座测试文件全量通过（261 项测试通过，0 失败，0 跳过）

---

## 1. G2 核心领域底座与架构实现

本阶段严格遵照 `plan.md` G2 目标，从基线中全量恢复 254 个核心文件，杜绝任何假实现或简化 mock，完整确立了 QM 作为多租户智能体系统的领域约束与持久化底座。

### 1.1 身份与作用域模型 (Principal & Scope)
- **严格作用域边界 (`ScopeId`)**：使用强类型品牌区分 `org:*`、`group:web-project-*`、`dm:*`、`channel:*`、`thread:*`，坚决禁止使用单一 `userId` 或平面字符串替代。
- **主体与权限解析 (`src/acl/`, `src/identity/`)**：
  - 支持资源前缀继承与多级权限判定（`read`, `write`, `admin`, `org_admin`）。
  - 支持条件原子替换（CAS 语义）、成员资格变更生命周期管理。
  - 目录服务 (`src/directory/`) 实现了跨租户、多工作区成员和频道的增量与全量快照原子置换，保证因果时序一致性。

### 1.2 会话状态机与租约机制 (Sessions & Leases)
- **单写者租约抢占 (`src/persistence/leader-lease.ts`)**：
  - 基于数据库 Advisory Lock 与心跳租约机制，保证多实例并发下的单写者互斥。
  - 支持超时自动探测、争抢者身份透传与 Reaper 强制接管路径。
- **单调递增时序与状态总线 (`src/sessions/`, `src/runs/`)**：
  - 会话消息流采用严格严格单调递增序列号 (`seq`)，支持转录带 (`session_tape`) 审计与增量重放。
  - 参与者可见性窗口机制：精确记录 `[valid_from, valid_to)` 与 `[valid_from_seq, valid_to_seq]`，绝不泄露非参与时段的历史会话，且对 overheard 旁路消息进行明确隔离。
  - 跨进程状态通知总线：基于 Postgres LISTEN/NOTIFY 实现轻量、低延迟的跨实例会话状态事件广播。

### 1.3 持久化与存储抽象 (Durable Storage Architecture)
- **持久化映射表 (`src/persistence/durable-map.ts`)**：
  - 提供 `DurableMap<T>` 通用持久化抽象，自动接入版本表 `durable_map_versions`。
  - JSONB 序列化边界防护：严格过滤 NUL (`\u0000`) 字符与畸形代理对，防止中文字符截断导致 PostgreSQL 写入崩溃。
- **核心数据表与存储引擎**：
  - 恢复全套业务 Store 实现：`PostgresSessionStore`, `PostgresRunStore`, `PostgresGrantStore`, `PostgresAdminGrantStore`, `PostgresDirectoryStore`, `PostgresFileArtifactStore`, `PostgresFileUploadStore`, `PostgresConfigStore`。
  - 审计与监控 Sink：`PostgresAuditLog`, `PostgresErrorLog`, `PostgresMetricsSink`。

---

## 2. 数据库迁移与运维脚本

本阶段补齐了生产级数据库初始化工具：
- 在 `scripts/migrate.mjs` 中注册全量 17 个核心持久化组件与 13 组 Durable Map 的模式迁移。
- 在 `package.json` 中登记 `"migrate": "node scripts/migrate.mjs"`。
- 执行结果：
  ```text
  [qm:migrate] database migrations applied: 155 migrations recorded, 136 tables ready
  ```

---

## 3. 测试验证矩阵与实测证据

在真实 PostgreSQL 环境（`qm_dev_17c43fbe33e1`）下执行 28 个核心底座测试套件，结果全部通过（261 pass, 0 fail）：

| 领域模块 | 测试文件 | 测试用例数 | 结论 |
| :--- | :--- | :--- | :--- |
| **ACL & 权限** | `test/acl-resource-prefix.test.ts` | 9 passed | PASS |
| | `test/acl-membership-manage.test.ts` | 10 passed | PASS |
| | `test/acl-conditional-replace.test.ts` | 1 passed | PASS |
| **身份与目录** | `test/identity.test.ts` | 15 passed | PASS |
| | `test/directory-store.test.ts` | 30 passed | PASS |
| | `test/resolution.test.ts` | 9 passed | PASS |
| **会话与状态机** | `test/session-store.test.ts` | 48 passed | PASS |
| | `test/session-syscalls.test.ts` | 30 passed | PASS |
| | `test/session-state-bus.test.ts` | 5 passed | PASS |
| | `test/postgres-broker-sessions.test.ts` | 1 passed | PASS |
| **租约与锁争抢** | `test/leader-lease.test.ts` | 6 passed | PASS |
| **PostgreSQL 存储**| `test/persistence-init-retry.test.ts` | 5 passed | PASS |
| | `test/postgres-admin-grants.test.ts` | 4 passed | PASS |
| | `test/postgres-grant-store.test.ts` | 9 passed | PASS |
| | `test/postgres-directory-store.test.ts` | 19 passed | PASS |
| | `test/postgres-audit-log.test.ts` | 3 passed | PASS |
| | `test/postgres-error-log.test.ts` | 4 passed | PASS |
| | `test/postgres-metrics-sink.test.ts` | 3 passed | PASS |
| | `test/postgres-migrations.test.ts` | 9 passed | PASS |
| | `test/postgres-listener.test.ts` | 3 passed | PASS |
| | `test/postgres-run-activity-store.test.ts` | 1 passed | PASS |
| | `test/postgres-run-stream.test.ts` | 1 passed | PASS |
| | `test/postgres-file-artifact-store.test.ts` | 13 passed | PASS |
| | `test/postgres-file-upload-store.test.ts` | 3 passed | PASS |
| | `test/postgres-config-store.test.ts` | 10 passed | PASS |
| **底层工具基石** | `test/util-crypto.test.ts` | 3 passed | PASS |
| | `test/util-shell.test.ts` | 2 passed | PASS |
| | `test/util-text.test.ts` | 5 passed | PASS |
| **汇总合计** | **28 个测试文件** | **261 passed, 0 failed** | **100% PASS** |

---

## 4. 提前恢复依赖闭包登记说明

依据 `plan.md` "按原文件及依赖闭包恢复" 的原则，为保证编译期和运行时模块解析完整闭合，本阶段预先恢复了少量叶子支撑模块：
1. `plugins/chassis/`：基础通信与错误报告公共包，供 `src/util/errors.ts` 共享。
2. `deploy/connector-sdk`：构建并生成 `pretest` 必需的 `.generated/connector-sdk/sdk.cjs`。
3. `src/triggers/provenance.ts` & `src/api/routes/admin/origins.ts`：会话来源分类器所必须。
4. `src/core/turn-origin.ts` & `src/core/turn-error.ts`：运行生命周期错误结构定义。
5. `src/swarms/swarm-settings.ts`：子会话多智能体配额设置。
6. `src/connectors/connector-client-store.ts`, `src/connectors/oauth.ts`, `src/credentials/secret-source.ts`：配置存储解析依赖。

所有上述模块的功能测试与集成装配归属其原本所属门控（G3/G4/G5），在本阶段仅作为静态类型与引用支撑，不越界声明完成。

---

## 5. 给后续 Agent (G3 与 G4 并行冲刺) 的执行指引

由于 G1 中已证明 **G3 (隔离执行面) 与 G4 (后台服务面) 之间零运行时依赖**，在 G2 底座就绪后，开发即可双轨并发：

### 5.1 G3 开发者执行指引 (隔离执行)
- 工作区分支：`gate/g03-isolation`
- 基线合并：`git merge --ff-only gate/g02-pass`
- 恢复重点：`src/harness/`, `src/sandbox/`, `src/processes/`, `src/tools/`
- 目标：拉起本地 Docker 沙箱，跑通沙箱执行契约与双 Scope 隔离。

### 5.2 G4 开发者执行指引 (后台服务)
- 工作区分支：`gate/g04-services`
- 基线合并：`git merge --ff-only gate/g02-pass`
- 恢复重点：`src/memory/`, `src/skills/`, `src/cron/`, `src/connectors/`, `src/webhooks/`
- 目标：跑通向量/文本记忆检索、Cron 调度队列与 Webhook 触发。
