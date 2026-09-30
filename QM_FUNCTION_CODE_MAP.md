# QM 系统全量功能与对应代码映射大表 (Master Architecture Ledger)

本文档是 QM 重建工程的**全量功能与对应代码映射大表**。
后续各个 Gate（G3、G4、G5...）均按照统一标准推进：**先用 Codebase Memory MCP 检索、一次性跑通全量相关测试、保留每轮分步推进记录，并在本文档中持续顺序追加续写**。

---

## 规范格式说明
每一项功能的记录均严格遵循：
`功能 : 对应目录和文件（含文件功能注释以及依赖哪些文件和内容的注释）`

---

# Gate 2：身份、作用域与状态底座 (G2 交付全景)

### 1. 基础类型与通用工具面 (`src/types.ts` & `src/util/`)
* **核心功能**：品牌化作用域隔离类型、安全加解密、防时序攻击、Shell 参数防注入与字符串截断处理。
* **对应目录与文件**：
  * **`src/types.ts`**
    * **文件功能**：定义系统所有不可变核心领域实体（`ScopeId` 品牌类型、`Principal` 主体身份工牌、`Grant` 权限元组、`Session` 会话结构体、`ActorAssertion` 机器鉴权）。
    * **依赖内容**：无外部依赖（全仓的最底层核心类型定义）。
  * **`src/config.ts`**
    * **文件功能**：集中校验与解析应用环境变量（`DATABASE_URL`、模型端点配置、S3/Slack 密钥等）。
    * **依赖内容**：依赖 `src/types.ts`（基础类型）、`src/memory/`（记忆策略配置类型）、`src/slack/config.ts`（通道配置）。
  * **`src/feature-flags.ts`**
    * **文件功能**：支持针对特定 `ScopeId` 动态灰度开启实验性特性的特性电闸（Feature Flags）。
    * **依赖内容**：依赖 `src/types.ts`（`ScopeId`）、`src/persistence/durable-map.ts`（持久化存储）。
  * **`src/util/text.ts`**
    * **文件功能**：提供安全截断 `headSlice` / `tailSlice`，处理 Unicode 代理对，防止中途切断损坏汉字或引发 Postgres JSONB 写入崩溃；提供 `pgTextSafe` 清洗 NUL 字符。
    * **依赖内容**：无外部依赖。
  * **`src/util/crypto.ts`**
    * **文件功能**：提供防侧信道攻击的恒定时间比对 `constantTimeEqual`、高抗碰撞分片哈希算法 `hashId`。
    * **依赖内容**：依赖 Node.js 原生 `node:crypto`。
  * **`src/util/shell.ts`**
    * **文件功能**：实现 POSIX 命令行参数安全转义函数 `shq()`，防止智能体在执行终端命令时遭受 Shell 注入攻击。
    * **依赖内容**：无外部依赖。
  * **`src/util/errors.ts`**
    * **文件功能**：统一错误码包装函数 `errMessage()`、异常吞咽保护器 `swallow()`。
    * **依赖内容**：无外部依赖。

---

### 2. 插件解耦通信底盘 (`plugins/chassis/`)
* **核心功能**：外部独立插件（`plugins/web-ui`、`plugins/admin`）与 Core 之间的零依赖通信中继，解耦源码。
* **对应目录与文件**：
  * **`plugins/chassis/source-auth-sign.ts`**
    * **文件功能**：计算插件发往核心系统时的 HMAC-SHA256 防伪签名。
    * **依赖内容**：依赖 `node:crypto`，完全不引用 core `src/` 代码。
  * **`plugins/chassis/core-client.ts`**
    * **文件功能**：自动带上签名头调用 QM Core HTTP API 的标准 Node.js HTTP/HTTPS 客户端。
    * **依赖内容**：依赖 `plugins/chassis/source-auth-sign.ts` 与 `node:http`。

---

### 3. 身份认证与离职阻断中心 (`src/identity/`)
* **核心功能**：对访问者进行同域员工、外部访客与机器人的划分；维护离职人员名单并执行 Fail-Closed 大小写折叠永久阻断。
* **对应目录与文件**：
  * **`src/identity/identity-service.ts`**
    * **文件功能**：实现 `IdentityService`。提供 `classifyPrincipal`（判定是 `internal`、`guest` 还是 `bot`）、`audienceIsAllInternal`（全员受众安全判定）与离职熔断机制。
    * **依赖内容**：依赖 `src/types.ts`、`src/directory/person.ts`（大小写折叠与同一人比对）、`src/persistence/durable-map.ts`（持久化离职与外部成员表）。
  * **`src/identity/external-members.ts`**
    * **文件功能**：外部组织/合作方成员生命周期与活跃状态判定 `externalMemberActive`。
    * **依赖内容**：无外部依赖。

---

### 4. 组织花名册与频道寻址中枢 (`src/directory/`)
* **核心功能**：公司全量人员名册、公开/私有频道及多人群聊（mpim）的智能寻址，前缀模糊匹配与防旧数据倒灌机制。
* **对应目录与文件**：
  * **`src/directory/person.ts`**
    * **文件功能**：提供基础人名/邮箱规范化函数 `samePerson()` 和 `personKey()`。
    * **依赖内容**：无外部依赖。
  * **`src/directory/visibility.ts`**
    * **文件功能**：定义频道的公私属性（`public` vs `private`）。
    * **依赖内容**：无外部依赖。
  * **`src/directory/directory-store.ts`**
    * **文件功能**：内存版花名册操作接口，实现智能前缀匹配 `resolve()`，遇到重名主动返回 `ambiguous` 候选列表，外部访客不可寻址。
    * **依赖内容**：依赖 `src/types.ts`、`src/directory/person.ts`、`src/directory/visibility.ts`。
  * **`src/directory/postgres-directory-store.ts`**
    * **文件功能**：PostgreSQL 花名册持久化。带时间戳校验（`stamped`），如果收到的外部同步包比数据库当前存储版本旧，严格执行 `refused stale swap`。
    * **依赖内容**：依赖 `src/directory/directory-store.ts`、`src/persistence/pg-pool.ts`。

---

### 5. 权限裁判所与资产授权 (`src/acl/`)
* **核心功能**：文件、技能、定时任务、凭据统一 Ref 定位与全员受众闭门交集判定（Audience Intersection）。
* **对应目录与文件**：
  * **`src/acl/resource-ref.ts`**
    * **文件功能**：资源统一定位符编解码（`parseRef`, `fileArtifactRef`, `skillRef`），前缀严格匹配过滤，防止凭据被当成文件读取。
    * **依赖内容**：无外部依赖。
  * **`src/acl/acl-store.ts`**
    * **文件功能**：核心鉴权裁判所。实现 `canManage` 校验只有群成员才能授权；实现 `handlesForAudience`，只要在场成员中有 1 个人无权查看文件，该文件立刻被彻底剔除。
    * **依赖内容**：依赖 `src/types.ts`、`src/acl/resource-ref.ts`、`src/directory/person.ts`。
  * **`src/acl/postgres-grant-store.ts`**
    * **文件功能**：PostgreSQL 授权持久化。行级去重幂等插入，配合单调递增版本号实现内存高速缓存与写入失效。
    * **依赖内容**：依赖 `src/types.ts`、`src/acl/acl-store.ts`、`src/persistence/pg-pool.ts`。

---

### 6. 对话环境装配与双层工作区物理隔离 (`src/resolution/`)
* **核心功能**：在单轮对话发起前，动态装配工作区、出站域名白名单策略与系统提示词。
* **对应目录与文件**：
  * **`src/resolution/resolution-service.ts`**
    * **文件功能**：核心环境装配调度。实现单人私聊挂载 `[org, personal]`、多人频道挂载 `[org, channel]` 严格隔离；全局工作区只读、频道工作区可写。
    * **依赖内容**：依赖 `src/types.ts`、`src/resolution/audience-floor.ts`、`src/resolution/egress-policy.ts`。
  * **`src/resolution/audience-floor.ts`**
    * **文件功能**：计算房间全员受众安全底线，按权限最低者确定工具审核门槛。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/resolution/egress-policy.ts`**
    * **文件功能**：计算当前 Scope 允许访问的外网域名白名单与敏感黑名单。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 7. 数据库连接池与分布式并发抢麦控制 (`src/persistence/`)
* **核心功能**：PostgreSQL 连接池管理、多实例原子级增量迁移、会话单写者租约锁、LISTEN/NOTIFY 跨节点实时唤醒。
* **对应目录与文件**：
  * **`src/persistence/pg-pool.ts`**
    * **文件功能**：连接池管理与 Schema 增量迁移执行引擎，通过 `qm_schema_migrations` 记录 57 项原子升级单。
    * **依赖内容**：依赖 `pg` 连接池、`src/util/errors.ts`。
  * **`src/persistence/leader-lease.ts`**
    * **文件功能**：分布式单写者排他租约锁。提供 `acquireLease`、`renewLease` 心跳续约、超时自愈与 Reaper 强制接管，防止会话被两个实例同时写乱。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`、`src/persistence/advisory-lock.ts`。
  * **`src/persistence/advisory-lock.ts`**
    * **文件功能**：基于 PostgreSQL `pg_advisory_xact_lock` 的互斥锁抽象。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/persistence/durable-map.ts`**
    * **文件功能**：带版本号通知的持久化 KV 表，清洗 NUL 字符防止 JSONB 损坏。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`、`src/util/text.ts`。
  * **`src/persistence/postgres-listener.ts`**
    * **文件功能**：基于 PostgreSQL `LISTEN/NOTIFY` 的跨实例实时广播总线，网络波动重连自动派发 `resync` 全局同步信号。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。

---

### 8. 会话状态机、转录带与任务信箱系统调用 (`src/sessions/` & `src/runs/`)
* **核心功能**：会话生命周期四状态机、单调递增时序 `seq`、在场时间窗历史遮光罩、子 Agent 独立线程派生与 Mailbox 异步信封投递。
* **对应目录与文件**：
  * **`src/sessions/session-store.ts`**
    * **文件功能**：定义会话核心抽象接口、四状态机（`idle`, `working`, `awaiting_input`, `error`）与在场时间窗。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/sessions/postgres-session-store.ts`**
    * **文件功能**：PostgreSQL 会话持久化与转录带（`session_entries`）追加写实现，带在场窗口过滤。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/sessions/session-syscalls.ts`**
    * **文件功能**：提供智能体跨会话系统调用（`open`, `write`, `read`, `wait`），支持多层级子 Agent 派生与消息传递。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`、`src/sessions/session-mailbox.ts`。
  * **`src/sessions/session-mailbox.ts`**
    * **文件功能**：子任务执行结果异步信封投递中枢，消除轮询与内存锁竞争。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。
  * **`src/runs/postgres-run-store.ts`**
    * **文件功能**：单轮 Run 任务输入输出与模型调用状态记录。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/runs/worker.ts`**
    * **文件功能**：后台任务执行引擎 Worker 进程。
    * **依赖内容**：依赖 `src/runs/postgres-run-store.ts`、`src/runs/turn-stream.ts`。

---

### 9. 多租户文件库与分片断点续传 (`src/files/`)
* **核心功能**：多租户文件安全隔离、SHA-256 哈希去重、大文件分片断点续传状态机与租约过期回收。
* **对应目录与文件**：
  * **`src/files/file-artifact-store.ts`**
    * **文件功能**：抽象多租户文件与代码构件仓储接口。
    * **依赖内容**：依赖 `src/types.ts`、`src/files/durable-byte-store.ts`。
  * **`src/files/postgres-file-artifact-store.ts`**
    * **文件功能**：基于 PostgreSQL 的文件元数据持久化、SHA-256 去重与安全删除。
    * **依赖内容**：依赖 `src/files/file-artifact-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/files/file-upload-store.ts`**
    * **文件功能**：支持分块断点上传的状态机、配额管理与过期上传清理。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。

---

### 10. 管理员全生命周期审计与度量 Sink (`src/admin/`)
* **核心功能**：按 ScopeId 追踪关键授权变更、系统异常堆栈持久化与性能指标时序采集。
* **对应目录与文件**：
  * **`src/admin/postgres-audit-log.ts`**
    * **文件功能**：PostgreSQL 审计日志存储，支持操作按 ScopeId 时间轴倒查回溯。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/admin/postgres-error-log.ts`**
    * **文件功能**：系统运行时未经捕获的崩溃堆栈与错误事件持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/admin/postgres-metrics-sink.ts`**
    * **文件功能**：系统性能监控指标（耗时、内存、吞吐）时序存储 Sink。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。

---

### 11. 开箱 Schema 自动化迁移入口 (`scripts/migrate.mjs`)
* **核心功能**：生产部署与本地研发的一键式数据库初始化。
* **对应目录与文件**：
  * **`scripts/migrate.mjs`**
    * **文件功能**：自动注册全库 16 大持久化模块并调用 `migrateRegisteredPgSchemas` 执行 57 项增量迁移，初始化 49 张物理数据表。
    * **依赖内容**：依赖各存储模块的创建函数与 `src/persistence/pg-pool.ts`。

---
---

# Gate 3：沙箱隔离、代码执行与模型网关面 (G3 交付全景)

### 1. 沙箱核心抽象与本地 Docker 执行环境 (`src/sandbox/`)
* **核心功能**：沙箱统一生命周期契约、容器挂载持久化（guestHome）、命令派发与环境安全清洗。
* **对应目录与文件**：
  * **`src/sandbox/sandbox.ts`**
    * **文件功能**：定义沙箱核心统一契约接口（`SandboxEnvironment`, `SandboxProcess`, `ExecResult`），规范所有沙箱厂商的生命周期。
    * **依赖内容**：依赖 `src/types.ts`（基础类型与作用域定义）。
  * **`src/sandbox/local-sandbox.ts`**
    * **文件功能**：本地 Docker 沙箱容器管理，支持卷挂载持久化目录（guestHome）、容器启停、命令执行与端口绑定。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/sandbox/docker-exec.ts`、`src/sandbox/sandbox-env.ts`。
  * **`src/sandbox/docker-exec.ts`**
    * **文件功能**：封装 Docker API 执行流，处理容器内进程双向输入输出管道。
    * **依赖内容**：依赖 `node:child_process`。
  * **`src/sandbox/sandbox-env.ts`**
    * **文件功能**：沙箱环境变量安全清洗、脱敏与安全注入（含代理与认证凭证）。
    * **依赖内容**：依赖 `src/config.ts`。
  * **`src/sandbox/sandbox-routing.ts`**
    * **文件功能**：动态沙箱运行时路由，根据 ScopeId、租户策略与资源配额决策底层沙箱实现。
    * **依赖内容**：依赖 `src/types.ts`、`src/sandbox/sandbox.ts`。
  * **`src/sandbox/sandbox-resources.ts`**
    * **文件功能**：沙箱计算资源配置与限制校验（CPU、内存配额控制）。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/sandbox/sandbox-destroy-scope.ts`**
    * **文件功能**：作用域级别沙箱资源批量安全销毁与清理逻辑。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/types.ts`。
  * **`src/sandbox/layer-tool-install.ts`**
    * **文件功能**：只读层外部工具包注入与安装流编排。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/sandbox/tar.ts`。
  * **`src/sandbox/ro-layers.ts`**
    * **文件功能**：管理沙箱只读镜像层及跨会话工具文件系统缓存。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/sandbox/tar.ts`**
    * **文件功能**：内存流式 Tar 归档与解包工具，用于沙箱文件跨网络高效传输。
    * **依赖内容**：依赖 `tar-stream`。
  * **`src/sandbox/exec-file-ops.ts`**
    * **文件功能**：沙箱内跨平台文件操作（读写、存在性检查、SHA-256 校验与文件检索）。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。

---

### 2. 外部多云算力沙箱生态适配 (`src/sandbox/`)
* **核心功能**：无缝对接主流云端沙箱与高性能 Serverless 容器执行环境。
* **对应目录与文件**：
  * **`src/sandbox/aws-sandbox.ts`**
    * **文件功能**：AWS ECS/MicroVM 轻量虚拟化微容器沙箱驱动。
    * **依赖内容**：依赖 `src/sandbox/aws-microvm-api.ts`、`src/sandbox/sandbox.ts`。
  * **`src/sandbox/aws-microvm-api.ts`**
    * **文件功能**：AWS MicroVM 控制平面底层 HTTP 客户端通信库。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/sandbox/sprites-sandbox.ts`**
    * **文件功能**：Sprites 微虚拟机秒级启动驱动与双工网络安全隔离。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/sandbox/exec-sandbox-base.ts`。
  * **`src/sandbox/e2b-sandbox.ts`**
    * **文件功能**：E2B 云端长连接代码执行沙箱驱动。
    * **依赖内容**：依赖 `src/sandbox/e2b-client.ts`、`src/sandbox/sandbox.ts`。
  * **`src/sandbox/e2b-client.ts`**
    * **文件功能**：E2B API 与流式事件通信协议封装。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/sandbox/modal-sandbox.ts`**
    * **文件功能**：Modal Serverless 高性能算力沙箱驱动与远程任务调度。
    * **依赖内容**：依赖 `src/sandbox/modal-client.ts`、`src/sandbox/modal-image.ts`。
  * **`src/sandbox/modal-client.ts`**
    * **文件功能**：Modal 服务端通信客户端与状态监听。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/sandbox/modal-image.ts`**
    * **文件功能**：Modal 镜像定义与远程自动化构建器。
    * **依赖内容**：无外部依赖。
  * **`src/sandbox/porter-sandbox.ts`**
    * **文件功能**：Porter 容器化集群沙箱编排与管理驱动。
    * **依赖内容**：依赖 `src/sandbox/porter-client.ts`、`src/sandbox/sandbox.ts`。
  * **`src/sandbox/porter-client.ts`**
    * **文件功能**：Porter 控制面 API 客户端。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/sandbox/superserve-sandbox.ts`**
    * **文件功能**：Superserve 专用算力沙箱驱动。
    * **依赖内容**：依赖 `src/sandbox/superserve-client.ts`、`src/sandbox/sandbox.ts`。
  * **`src/sandbox/superserve-client.ts`**
    * **文件功能**：Superserve 通信协议客户端。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/sandbox/smolmachines-sandbox.ts`**
    * **文件功能**：Smolmachines 轻量级微虚拟机沙箱驱动。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/sandbox/agent37-sandbox.ts`**
    * **文件功能**：Agent37 专用微容器沙箱驱动。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/sandbox/sandbox-migrate.ts`**
    * **文件功能**：沙箱跨主机持久化数据迁移状态机。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/sandbox/sandbox-migration-runner.ts`**
    * **文件功能**：沙箱迁移执行调度引擎。
    * **依赖内容**：依赖 `src/sandbox/sandbox-migrate.ts`。

---

### 3. 长程会话与持久化进程池 (`src/processes/` & `src/sandbox/`)
* **核心功能**：交互式命令行 Session 状态机、长连接双工管道、存活心跳探针与僵尸进程回收。
* **对应目录与文件**：
  * **`src/sandbox/exec-process-session.ts`**
    * **文件功能**：交互式终端 Process Session 会话管理器，支持 PTY、长连接管道与并发输入输出。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/util/async.ts`。
  * **`src/sandbox/process-poll.ts`**
    * **文件功能**：进程状态轮询与存活心跳探针。
    * **依赖内容**：依赖 `src/util/async.ts`。
  * **`src/processes/process-registry.ts`**
    * **文件功能**：分布式后台进程注册表与元数据持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/processes/process-reaper.ts`**
    * **文件功能**：僵尸进程孤儿回收器与超时强制截断。
    * **依赖内容**：依赖 `src/processes/process-registry.ts`。
  * **`src/processes/reconcile.ts`**
    * **文件功能**：进程状态调和器，同步容器生命周期与数据库状态。
    * **依赖内容**：依赖 `src/processes/process-registry.ts`。
  * **`src/sandbox/await-process-exit.ts`**
    * **文件功能**：异步等待进程终结与状态退出码捕获。
    * **依赖内容**：无外部依赖。
  * **`src/sandbox/exec-kill.ts`**
    * **文件功能**：进程树强制终结与跨平台信号发送。
    * **依赖内容**：依赖 `node:child_process`。

---

### 4. 统一模型接入网关与凭证体系 (`src/model/`)
* **核心功能**：统一模型接入网关、多厂商端点覆盖配置、自定义 Provider 动态注册与账号凭据隔离。
* **对应目录与文件**：
  * **`src/model/gateway-models.ts`**
    * **文件功能**：模型网关支持的已知模型定义与能力元数据。
    * **依赖内容**：无外部依赖。
  * **`src/model/provider-endpoints.ts`**
    * **文件功能**：集中式模型提供商基础端点解析与覆盖配置。
    * **依赖内容**：依赖 `src/model/gateway-models.ts`。
  * **`src/model/custom-providers.ts`**
    * **文件功能**：管理员动态自定义 Provider 注册与配置解析。
    * **依赖内容**：依赖 `src/config.ts`。
  * **`src/model/custom-provider-store.ts`**
    * **文件功能**：自定义模型提供商持久化存储。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/model/user-model-credential-store.ts`**
    * **文件功能**：用户私有模型凭据与账号隔离存储。
    * **依赖内容**：依赖 `src/credentials/keychain.ts`。
  * **`src/model/model-catalog.ts`**
    * **文件功能**：模型目录元数据汇总与模型能力分类。
    * **依赖内容**：依赖 `src/model/gateway-models.ts`。
  * **`src/model/model-gateway.ts`**
    * **文件功能**：集中式模型网关请求路由与签名代理。
    * **依赖内容**：依赖 `src/model/provider-endpoints.ts`。
  * **`src/model/codex-device-login.ts`**
    * **文件功能**：OpenAI ChatGPT 订阅设备码 OAuth 授权流交互。
    * **依赖内容**：依赖 `src/util/errors.ts`。

---

### 5. 多框架智能体运行时 Harness 体系 (`src/harness/`)
* **核心功能**：统一 Harness 契约、Pi/Claude/Codex/OpenCode 多模型引擎原生适配、转录磁带顺序落地与思考深度控制。
* **对应目录与文件**：
  * **`src/harness/harness.ts`**
    * **文件功能**：定义统一 Harness 顶层接口契约（`runTurn`, `detectTurn`, `compactHistory`）。
    * **依赖内容**：依赖 `src/types.ts`、`src/sessions/session-store.ts`。
  * **`src/harness/pi-harness.ts`**
    * **文件功能**：核心 Pi 架构智能体运行时，支持思考深度控制、快速模式计费、步骤间隙归因、空响应自愈与转录磁带流式顺序落地。
    * **依赖内容**：依赖 `src/harness/harness.ts`、`src/model/pi-models.ts`、`src/harness/agent-tools.ts`。
  * **`src/harness/claude-harness.ts`**
    * **文件功能**：原生 Anthropic Claude Agent SDK 适配层。
    * **依赖内容**：依赖 `src/harness/harness.ts`、`@anthropic-ai/claude-agent-sdk`。
  * **`src/harness/codex-harness.ts`**
    * **文件功能**：OpenAI Codex 双工 App-Server 运行时适配器。
    * **依赖内容**：依赖 `src/harness/harness.ts`、`src/harness/codex-app-server.ts`、`src/harness/codex-auth-store.ts`。
  * **`src/harness/codex-app-server.ts`**
    * **文件功能**：Codex app-server 子进程生命周期与 JSON-RPC 通信管理。
    * **依赖内容**：依赖 `node:child_process`、`src/util/errors.ts`。
  * **`src/harness/codex-auth-store.ts`**
    * **文件功能**：Codex ChatGPT 账号 OAuth 凭据轮转与原子持有存储。
    * **依赖内容**：依赖 `src/credentials/keychain.ts`。
  * **`src/harness/opencode-harness.ts`**
    * **文件功能**：OpenCode 统一模型网关运行时适配器。
    * **依赖内容**：依赖 `src/harness/harness.ts`、`@opencode-ai/sdk`。
  * **`src/harness/mock-harness.ts`**
    * **文件功能**：测试与离线模拟 Harness 运行时。
    * **依赖内容**：依赖 `src/harness/harness.ts`。
  * **`src/harness/harness-router.ts`**
    * **文件功能**：跨 Harness 动态路由与多模型调度中心。
    * **依赖内容**：依赖 `src/harness/harness.ts`。
  * **`src/harness/agent-tools.ts`**
    * **文件功能**：Agent 系统核心工具注册库（终端执行、文件读写、沙箱交互、搜索等）。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/types.ts`。
  * **`src/harness/goal-tools.ts`**
    * **文件功能**：目标驱动多轮自动循环执行工具。
    * **依赖内容**：依赖 `src/harness/agent-tools.ts`。
  * **`src/harness/replay.ts`**
    * **文件功能**：会话转录磁带回放与历史上下文重建器。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。
  * **`src/harness/tape-fold.ts`**
    * **文件功能**：转录磁带折叠与防陈旧修剪机制。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。
  * **`src/harness/tape-projection.ts`**
    * **文件功能**：磁带到不同模型输入消息格式的投影视图。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。
  * **`src/harness/runtime-control.ts`**
    * **文件功能**：运行时中途控制与外部干预信号处理。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/harness/runtime-recovery.ts`**
    * **文件功能**：运行时崩溃后自动拉起与状态恢复。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 6. MCP (Model Context Protocol) 插件客户端与工具服务 (`src/mcp/`)
* **核心功能**：通用 Model Context Protocol 客户端连接、服务动态发现与模型工具注入。
* **对应目录与文件**：
  * **`src/mcp/mcp-client.ts`**
    * **文件功能**：基于 HTTP/SSE 的通用 Model Context Protocol 客户端实现。
    * **依赖内容**：依赖 `node:http`、`src/util/errors.ts`。
  * **`src/mcp/mcp-server-store.ts`**
    * **文件功能**：管理员配置的 MCP 服务器注册表持久化存储。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/mcp/mcp-tool-service.ts`**
    * **文件功能**：将 MCP 注册服务动态转换为带作用域命名空间的 Agent 可调用工具。
    * **依赖内容**：依赖 `src/mcp/mcp-client.ts`、`src/mcp/mcp-server-store.ts`。

---

### 7. 限流、集群栅栏与任务流水线 (`src/ratelimit/`, `src/swarms/`, `src/tasks/`)
* **核心功能**：分布式令牌桶限流、模型调用预算熔断、Swarm 多智能体集群防脑裂栅栏与任务排队。
* **对应目录与文件**：
  * **`src/ratelimit/rate-limiter.ts`**
    * **文件功能**：令牌桶速率限制与模型调用并发预算控制抽象。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/ratelimit/postgres-rate-limiter.ts`**
    * **文件功能**：基于 PostgreSQL 的分布式原子速率限制器。
    * **依赖内容**：依赖 `src/ratelimit/rate-limiter.ts`、`src/persistence/pg-pool.ts`。
  * **`src/ratelimit/budget.ts`**
    * **文件功能**：组织与个人模型调用开销预算管理。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/ratelimit/postgres-budget.ts`**
    * **文件功能**：基于 PostgreSQL 的持久化预算追踪与熔断。
    * **依赖内容**：依赖 `src/ratelimit/budget.ts`、`src/persistence/pg-pool.ts`。
  * **`src/swarms/swarm-store.ts`**
    * **文件功能**：Swarm 智能体集群元数据与分布式成员管理。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/swarms/swarm-service.ts`**
    * **文件功能**：Swarm 工作流协同与任务调度服务。
    * **依赖内容**：依赖 `src/swarms/swarm-store.ts`。
  * **`src/swarms/swarm-fence.ts`**
    * **文件功能**：Swarm 分布式执行栅栏，防止工作节点脑裂或越权冲突。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/tasks/task-store.ts`**
    * **文件功能**：异步持久化任务抽象契约。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/tasks/postgres-task-store.ts`**
    * **文件功能**：PostgreSQL 驱动的任务队列与执行状态持久化。
    * **依赖内容**：依赖 `src/tasks/task-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/tasks/memory-task-store.ts`**
    * **文件功能**：内存态无持久化测试任务存储。
    * **依赖内容**：依赖 `src/tasks/task-store.ts`。

---

### 8. 智能记忆与知识检索系统 (`src/memory/`)
* **核心功能**：Agent 长期记忆提取、多轮对话归纳（Consolidation）、Scratch 空间向持久层晋升、Markdown 笔记语法解析与 Postgres 向量实体检索。
* **对应目录与文件**：
  * **`src/memory/memory-service.ts`**
    * **文件功能**：工作区 Markdown 记忆读写、历史版本管理与修订快照服务。
    * **依赖内容**：依赖 `src/types.ts`、`src/workspace/workspace-store.ts`、`src/util/async.ts`、`src/memory/notebook.ts`。
  * **`src/memory/postgres-memory-service.ts`**
    * **文件功能**：基于 PostgreSQL 的记忆条目、向量检索与实体记忆持久化存储。
    * **依赖内容**：依赖 `src/memory/memory-service.ts`、`src/persistence/pg-pool.ts`。
  * **`src/memory/notebook.ts`**
    * **文件功能**：记忆 Markdown 笔记语法解析器与结构化行语法器。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/memory/strategy.ts`**
    * **文件功能**：记忆提取策略接口定义与策略注册。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/memory/strategies/scratch-promote.ts`**
    * **文件功能**：草稿与每日日志向核心长期记忆晋升策略。
    * **依赖内容**：依赖 `src/memory/strategy.ts`、`src/memory/notebook.ts`。
  * **`src/memory/strategies/consolidation.ts`**
    * **文件功能**：多轮对话深层整合与记忆压缩策略。
    * **依赖内容**：依赖 `src/memory/strategy.ts`、`src/memory/notebook.ts`。
  * **`src/memory/strategies/agent-only.ts`**
    * **文件功能**：仅由 Agent 显式调用维护的记忆提取策略。
    * **依赖内容**：依赖 `src/memory/strategy.ts`。
  * **`src/memory/strategies/per-turn.ts`**
    * **文件功能**：单轮对话实时抽取与背景增量更新策略。
    * **依赖内容**：依赖 `src/memory/strategy.ts`。
  * **`src/memory/provider-router.ts`**
    * **文件功能**：多记忆提供方（本地 Markdown、Postgres 向量、远程 MCP）动态路由。
    * **依赖内容**：依赖 `src/memory/memory-service.ts`、`src/memory/provider-config.ts`。
  * **`src/memory/mcp-memory-provider.ts`**
    * **文件功能**：基于 Model Context Protocol 远程协议的外部记忆服务提供者。
    * **依赖内容**：依赖 `src/memory/memory-service.ts`、`src/mcp/mcp-client.ts`。

---

### 9. 技能发现、打包、同步与沙箱物化体系 (`src/skills/`)
* **核心功能**：技能包规范化解析、Git 仓库拉取、代码打包与归档、沙箱动态挂载物化、命名冲突探测与自动授权。
* **对应目录与文件**：
  * **`src/skills/skill-store.ts`**
    * **文件功能**：技能注册表核心抽象契约与内存实现。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/skills/skill-pack-store.ts`**
    * **文件功能**：技能包仓库元数据与持久化记录管理。
    * **依赖内容**：依赖 `src/skills/skill-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/skills/skill-bundle-store.ts`**
    * **文件功能**：打包后的技能 Bundle 缓存与版本哈希存储。
    * **依赖内容**：依赖 `src/skills/skill-store.ts`。
  * **`src/skills/pack-fetcher.ts`**
    * **文件功能**：从远程 Git 仓库或本地文件目录拉取技能包代码。
    * **依赖内容**：依赖 `src/util/shell.ts`、`src/util/errors.ts`。
  * **`src/skills/skill-sync-engine.ts`**
    * **文件功能**：定时同步远程技能仓库变更并更新本地注册表。
    * **依赖内容**：依赖 `src/skills/skill-pack-store.ts`、`src/skills/pack-fetcher.ts`。
  * **`src/skills/materialize.ts`**
    * **文件功能**：将技能包动态注入并物化到沙箱环境的文件系统中。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`、`src/skills/skill-bundle-store.ts`。
  * **`src/skills/frontmatter.ts`**
    * **文件功能**：技能说明文档（SKILL.md）的 Frontmatter 元数据解析与校验。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/skills/skill-collision.ts`**
    * **文件功能**：跨技能包指令同名冲突与优先级碰撞裁决。
    * **依赖内容**：依赖 `src/skills/skill-name.ts`。
  * **`src/skills/seed.ts`**
    * **文件功能**：系统开箱即用的内置种子技能包加载器。
    * **依赖内容**：依赖 `src/skills/skill-store.ts`。

---

### 10. 钥匙串、服务凭证与共享凭据安全代理 (`src/credentials/`)
* **核心功能**：环境级与组织级敏感凭据加密保管、钥匙串交互式授权问询（Ask）、动态文件与环境变量注入、共享凭据断点恢复与调用审计下沉。
* **对应目录与文件**：
  * **`src/credentials/keychain.ts`**
    * **文件功能**：钥匙串凭证统一管理、安全解密、作用域隔离与凭证注入。
    * **依赖内容**：依赖 `src/config.ts`、`src/types.ts`、`src/connectors/connector-client-store.ts`、`src/util/errors.ts`。
  * **`src/credentials/secret-drop.ts`**
    * **文件功能**：一次性敏感凭证临时投递与自毁机制。
    * **依赖内容**：依赖 `src/util/crypto.ts`。
  * **`src/credentials/secret-source.ts`**
    * **文件功能**：从环境变量、文件系统与远程配置源解析凭据来源。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/credentials/resident-auth.ts`**
    * **文件功能**：沙箱内部常驻认证信息管理与安全隔离。
    * **依赖内容**：依赖 `src/credentials/keychain.ts`。
  * **`src/credentials/device-flow-cutover.ts`**
    * **文件功能**：设备授权流（Device Authorization Flow）切流与凭证安全持久化。
    * **依赖内容**：依赖 `src/credentials/keychain.ts`。
  * **`src/credentials/harness-auth-env.ts`**
    * **文件功能**：模型 Harness 执行时按需注入的认证环境变量组装器。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/credentials/postgres-credential-usage-sink.ts`**
    * **文件功能**：基于 PostgreSQL 的敏感凭证使用审计日志异步落盘下沉。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。

---

### 11. 外部连接器与集成协议生态 (`src/connectors/`, `src/sandbox/connector-sdk.ts`)
* **核心功能**：第三方外部系统连接器（Composio、自定义 BYO）、OAuth 鉴权状态机、客户端会话槽位映射与沙箱专用 SDK 自动分发。
* **对应目录与文件**：
  * **`src/connectors/connector-client-store.ts`**
    * **文件功能**：连接器客户端授权凭证与槽位元数据持久化存储。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/connectors/oauth.ts`**
    * **文件功能**：通用第三方 OAuth 2.0 鉴权握手与令牌刷新引擎。
    * **依赖内容**：依赖 `src/util/errors.ts`。
  * **`src/connectors/oauth-flow-store.ts`**
    * **文件功能**：OAuth 临时会话状态与 PKCE 校验凭据持久化存储。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/connectors/browser-session-store.ts`**
    * **文件功能**：针对需要浏览器鉴权的连接器会话状态持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/connectors/background-exec-broker.ts`**
    * **文件功能**：连接器后台执行代理与长任务状态桥接。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/sandbox/connector-sdk.ts`**
    * **文件功能**：跨平台沙箱环境中 Composio / 自建连接器 SDK 的原子安装、软链接与哈希校验。
    * **依赖内容**：依赖 `node:crypto`、`node:fs`、`src/util/shell.ts`。

---

### 12. 可靠结果投递与转录同步服务 (`src/delivery/`)
* **核心功能**：Agent 执行结果多端可靠分发、转录增量推送、租约认领抢占（Drain Claim）与投递幂等去重。
* **对应目录与文件**：
  * **`src/delivery/delivery-store.ts`**
    * **文件功能**：投递状态记录抽象契约与内存实现。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/delivery/postgres-delivery-store.ts`**
    * **文件功能**：基于 PostgreSQL 的投递任务队列、行锁抢占与状态持久化。
    * **依赖内容**：依赖 `src/delivery/delivery-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/delivery/run-result-delivery.ts`**
    * **文件功能**：执行完成结果向用户界面或外部通道组装并触发投递。
    * **依赖内容**：依赖 `src/types.ts`、`src/delivery/delivery-store.ts`。
  * **`src/delivery/web-transcript-delivery.ts`**
    * **文件功能**：针对 Web 端与长轮询客户端的实时会话转录投递通道。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。

---

### 13. 分布式定时任务调度与执行队列 (`src/cron/`)
* **核心功能**：分布式 Cron 表达式调度器、Postgres 原子作业排队、防重复触发锁与调度安全护栏。
* **对应目录与文件**：
  * **`src/cron/cron-store.ts`**
    * **文件功能**：Cron 任务定义、运行计划与下次触发时钟存储。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/cron/scheduler.ts`**
    * **文件功能**：分布式调度主循环、时钟对齐、任务激活与领导者租约竞争。
    * **依赖内容**：依赖 `src/cron/cron-store.ts`、`src/cron/job-queue.ts`、`src/persistence/leader-lease.ts`、`src/util/sweeper.ts`。
  * **`src/cron/job-queue.ts`**
    * **文件功能**：基于 PostgreSQL SKIP LOCKED 的 Cron 作业并发执行队列。
    * **依赖内容**：依赖 `src/cron/cron-store.ts`、`src/persistence/pg-pool.ts`。
  * **`src/cron/fire-store.ts`**
    * **文件功能**：Cron 历史触发执行记录（Fire Logs）审计持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/cron/schedule.ts`**
    * **文件功能**：Cron 语法解析、区间计算与下次执行时间推算。
    * **依赖内容**：依赖 `src/util/time.ts`。
  * **`src/cron/authority.ts`**
    * **文件功能**：Cron 任务执行权限判定与执行者作用域鉴权。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 14. Webhook 接收、校验与事件触发器 (`src/webhooks/`, `src/triggers/`)
* **核心功能**：多平台外部 Webhook 签名验证（GitHub、Slack、Stripe 等）、请求暂存入库与基于事件驱动的 Agent 触发流。
* **对应目录与文件**：
  * **`src/webhooks/webhook-store.ts`**
    * **文件功能**：外部 Webhook 接收记录、载荷快照与处理状态持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/webhooks/webhook-receiver.ts`**
    * **文件功能**：统一 Webhook 入口路由、幂等校验与入库调度分发。
    * **依赖内容**：依赖 `src/webhooks/webhook-store.ts`、`src/webhooks/verifiers.ts`。
  * **`src/webhooks/verifiers.ts`**
    * **文件功能**：各主流外部集成商 Webhook 密码学签名校验规则库。
    * **依赖内容**：依赖 `node:crypto`。
  * **`src/triggers/trigger-store.ts`**
    * **文件功能**：自动化事件触发规则配置持久化存储。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/triggers/run-trigger.ts`**
    * **文件功能**：触发器事件判定、用户授权校验与 Agent 轮次（Turn）派发驱动。
    * **依赖内容**：依赖 `src/triggers/trigger-store.ts`、`src/types.ts`。
  * **`src/triggers/consent-notice.ts`**
    * **文件功能**：外部自动化事件触发敏感操作时的用户二次确认通知机制。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/triggers/provenance.ts`**
    * **文件功能**：事件触发溯源追踪与安全上下文防伪链路。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 15. 项目空间与工作区部署服务 (`src/projects/`, `src/deploy/`)
* **核心功能**：多租户项目空间数据隔离、内部应用容器化/Serverless 部署提供方集成、部署状态机与隧道代理。
* **对应目录与文件**：
  * **`src/projects/project-store.ts`**
    * **文件功能**：项目空间元数据、工作区绑定与权限关系持久化存储。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/deploy/deploy-store.ts`**
    * **文件功能**：部署实例、版本构建快照与配置环境变量持久化。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/deploy/deploy-service.ts`**
    * **文件功能**：应用发布、回滚、状态检查与部署生命周期调度中心。
    * **依赖内容**：依赖 `src/deploy/deploy-store.ts`、`src/deploy/deploy-provider.ts`。
  * **`src/deploy/docker-deploy-provider.ts`**
    * **文件功能**：基于本地/远程 Docker 引擎的容器构建与部署驱动。
    * **依赖内容**：依赖 `src/deploy/deploy-provider.ts`。
  * **`src/deploy/fly-deploy-provider.ts`**
    * **文件功能**：Fly.io 云平台微容器自动化发布与网络互联驱动。
    * **依赖内容**：依赖 `src/deploy/deploy-provider.ts`。
  * **`src/deploy/aws-deploy-provider.ts`**
    * **文件功能**：AWS ECS/AppRunner 云上无服务器应用部署提供方。
    * **依赖内容**：依赖 `src/deploy/deploy-provider.ts`。
  * **`src/deploy/porter-deploy-provider.ts`**
    * **文件功能**：Porter PaaS Kubernetes 部署提供者。
    * **依赖内容**：依赖 `src/deploy/deploy-provider.ts`。
  * **`src/deploy/shared-deploy-provider.ts`**
    * **文件功能**：多应用共享托管环境轻量部署驱动。
    * **依赖内容**：依赖 `src/deploy/deploy-provider.ts`。

---

### 16. 交互表面快照与环境上下文感知 (`src/surface-cache/`, `src/api/surface-context-puller.ts`)
* **核心功能**：各端状态快照（Surface Cache）、频道权限策略快照、环境上下文增量拉取与注入。
* **对应目录与文件**：
  * **`src/surface-cache/surface-cache.ts`**
    * **文件功能**：交互通道（Slack 频道、用户列表等）状态快照抽象与 PostgreSQL 持久化。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/surface-cache/channel-policy-store.ts`**
    * **文件功能**：特定频道/表面响应策略与自动化参与规则持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/surface-cache/ambient-judge.ts`**
    * **文件功能**：基于表面上下文的环境常驻发言意图判定决策器。
    * **依赖内容**：依赖 `src/surface-cache/surface-cache.ts`。
  * **`src/api/surface-context-puller.ts`**
    * **文件功能**：在 Agent 轮次启动前异步聚合各表面的最新上下文数据。
    * **依赖内容**：依赖 `src/surface-cache/surface-cache.ts`、`src/types.ts`。

---

### 17. 智能建议流与活动推荐引擎 (`src/suggestions/`)
* **核心功能**：基于会话进展与项目上下文的主动推荐活动生成与持久化展示。
* **对应目录与文件**：
  * **`src/suggestions/activities.ts`**
    * **文件功能**：建议活动数据模型、生成逻辑与生命周期状态流转。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。

---

### 18. 会话唤醒巡检与外部资源监控 (`src/wake/`, `src/monitors/`)
* **核心功能**：挂起/后台长任务会话的主动唤醒（Wake）、轮询巡检与外部第三方资源状态监控（Monitors）。
* **对应目录与文件**：
  * **`src/wake/wake.ts`**
    * **文件功能**：会话唤醒信封格式、唤醒理由与投递驱动。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/wake/sweep.ts`**
    * **文件功能**：定期扫描处于等待状态需要被唤醒激活的会话队列。
    * **依赖内容**：依赖 `src/wake/wake.ts`、`src/sessions/session-store.ts`。
  * **`src/wake/engaged-registry.ts`**
    * **文件功能**：当前正在积极交互与运行的活跃会话租约注册表。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/monitors/monitor-store.ts`**
    * **文件功能**：外部资源监听配置与触发条件持久化存储。
    * **依赖内容**：依赖 `src/types.ts`、`src/persistence/pg-pool.ts`。
  * **`src/monitors/monitor-poller.ts`**
    * **文件功能**：定期轮询被监控资源的当前状态与阈值比对器。
    * **依赖内容**：依赖 `src/monitors/monitor-store.ts`。
  * **`src/monitors/monitor-broker.ts`**
    * **文件功能**：监控警报与状态变更事件向 Agent 会话的消息通知代理。
    * **依赖内容**：依赖 `src/monitors/monitor-store.ts`、`src/types.ts`。

---

### 19. 核心组装、正式入口与系统接线 (`src/wiring.ts`, `src/index.ts`, `src/instrument.ts`, `src/egress-authz-main.ts`)
* **核心功能**：Core 完整运行时依赖倒置注入工厂（DI Wiring）、进程生命周期管理、Sentry 遥测初始化与外部网络流量授权代理主服务。
* **对应目录与文件**：
  * **`src/wiring.ts`**
    * **文件功能**：系统装配中心，统一构建持久化 Store 单例、初始化模型 Harness 路由、组装沙箱环境、注册安全审查策略、挂载后台 Worker 并导出完整 HTTP App。
    * **依赖内容**：依赖全系统底层 Store、`src/core/orchestrator.ts`、`src/api/app.ts`、`src/runs/worker.ts`、`src/config.ts`。
  * **`src/index.ts`**
    * **文件功能**：QM Core 正式生产主进程入口，负责加载配置、执行接线、启动 HTTP 服务端与注册优雅关机（Graceful Shutdown）信号。
    * **依赖内容**：依赖 `src/wiring.ts`、`src/api/server.ts`、`src/config.ts`。
  * **`src/instrument.ts`**
    * **文件功能**：Sentry 异常捕获与 OpenTelemetry 分布式链路追踪插桩初始化。
    * **依赖内容**：依赖 `@sentry/node`。
  * **`src/egress-authz-main.ts`**
    * **文件功能**：独立外部流量出口授权守护进程，控制沙箱内部对外部域名与网络的访问权限。
    * **依赖内容**：依赖 `src/config.ts`、`src/auth/capability-token.ts`。

---

### 20. 统一 HTTP 服务器、路由中间件与端点总线 (`src/api/server.ts`, `src/api/http.ts`, `src/api/deps.ts`, `src/api/routes/`, `src/api/user-scoped-routes.ts`)
* **核心功能**：原生高性能 HTTP 服务层、请求签名验签中间件、身份授权萃取、SSE 流式打字机通道与全量 RESTful 业务路由表。
* **对应目录与文件**：
  * **`src/api/server.ts`**
    * **文件功能**：Node.js 原生 HTTP 服务器创建、请求体积上限控制、路由分发与健康检查探针（`/healthz`）。
    * **依赖内容**：依赖 `node:http`、`src/api/http.ts`、`src/api/routes/index.ts`。
  * **`src/api/http.ts`**
    * **文件功能**：HTTP 上下文包装、JSON 序列化响应、Source-Auth 签名鉴权校验与 Bearer Capability Token 解析。
    * **依赖内容**：依赖 `src/auth/source-auth.ts`、`src/auth/capability-token.ts`。
  * **`src/api/deps.ts`**
    * **文件功能**：API 路由所依赖的全量服务实例类型接口集合定义（ServerDeps）。
    * **依赖内容**：依赖各领域 Store 与 Service 接口定义。
  * **`src/api/routes/index.ts`**
    * **文件功能**：RESTful 路由总装矩阵，统一注册 turns、sessions、runs、admin、crons、webhooks 等端点处理函数。
    * **依赖内容**：依赖 `src/api/routes/` 内部全部子路由模块。
  * **`src/api/routes/turns.ts`**
    * **文件功能**：Agent 对话轮次提交（`/v1/turns`）、排队查询、指标记录与主动取消端点。
    * **依赖内容**：依赖 `src/api/app.ts`、`src/api/http.ts`。
  * **`src/api/routes/run-events.ts`**
    * **文件功能**：服务端事件推送（SSE 流：`/api/runs/:runId/events`），向客户端实时流式回传思考过程、文本 Delta 与工具调用事件。
    * **依赖内容**：依赖 `src/runs/run-stream.ts`、`src/runs/run-store.ts`。
  * **`src/api/routes/admin.ts`** 与 **`src/api/routes/admin-resources.ts`**
    * **文件功能**：管理控制台 API 集合，提供组织范围模型、凭据、沙箱、安全策略、成员与审计日志的管理端点。
    * **依赖内容**：依赖 `src/admin/admin-service.ts`、`src/api/http.ts`。
  * **`src/api/routes/deployments.ts`**
    * **文件功能**：内部应用部署、发布、回滚、环境变量配置与子域名路由反向代理端点。
    * **依赖内容**：依赖 `src/deploy/deploy-store.ts`、`src/deploy/deploy-service.ts`。
  * **`src/api/routes/loops.ts`** 与 **`src/api/routes/loop-items.ts`**
    * **文件功能**：自治循环（Loops）增删改查、执行队列调度与人工审核确认 HTTP 交互接口。
    * **依赖内容**：依赖 `src/loops/loop-store.ts`、`src/loops/runner.ts`。
  * **`src/api/user-scoped-routes.ts`**
    * **文件功能**：用户上下文约束中间件，防止跨租户和越权访问用户私有会话与文件。
    * **依赖内容**：依赖 `src/api/http.ts`、`src/types.ts`。

---

### 21. App 核心门面与业务用例聚合 (`src/api/app.ts`, `src/api/app-*.ts`)
* **核心功能**：Core 顶层业务外观模式实现，将底层零散领域模型聚合为面向交互表面的标准用例接口。
* **对应目录与文件**：
  * **`src/api/app.ts`**
    * **文件功能**：Core App 核心实例类，对外暴露 `turn()`、`getRun()`、`listSessions()` 等标准操作。
    * **依赖内容**：依赖 `src/api/app-turn.ts`、`src/api/app-sessions.ts`、`src/api/app-messaging.ts` 等分模块。
  * **`src/api/app-turn.ts`**
    * **文件功能**：Turn 轮次准入逻辑封装，处理入参标准化、自动恢复探测、排队入库与异步 Worker 派发。
    * **依赖内容**：依赖 `src/runs/run-store.ts`、`src/core/turn-origin.ts`、`src/types.ts`。
  * **`src/api/app-sessions.ts`**
    * **文件功能**：会话生命周期门面，处理会话创建、标题自动生成、分支 Fork、权限投影与归档。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`、`src/sessions/session-view.ts`。
  * **`src/api/app-messaging.ts`**
    * **文件功能**：统一消息收发门面，处理历史消息读取、参与者过滤与跨表面广播投递。
    * **依赖内容**：依赖 `src/sessions/transcript-tape.ts`、`src/directory/directory-store.ts`。
  * **`src/api/app-search.ts`** 与 **`src/api/app-resource-search.ts`**
    * **文件功能**：多模态全文检索与资源定位服务（支持历史对话、工作区文件与技能匹配）。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`、`src/types.ts`。
  * **`src/api/app-skills.ts`**
    * **文件功能**：技能包对用户的可见性计算、授权过滤与沙箱热加载门面。
    * **依赖内容**：依赖 `src/skills/` 模块。
  * **`src/api/app-deployments.ts`**
    * **文件功能**：应用部署状态机调度与用户权限校验包装。
    * **依赖内容**：依赖 `src/deploy/deploy-store.ts`。
  * **`src/api/app-ambient.ts`**
    * **文件功能**：环境常驻感知判定与无唤醒词条件下的被动发言意图计算。
    * **依赖内容**：依赖 `src/surface-cache/ambient-judge.ts`。
  * **`src/api/app-helpers.ts`** 与 **`src/api/app-types.ts`**
    * **文件功能**：App 门面内部公共辅助函数与参数数据结构契约定义。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 22. Agent 统一编排器与多轮上下文生命周期 (`src/core/orchestrator.ts`, `src/core/orchestrator/`)
* **核心功能**：Agent 核心执行状态机，驱动系统提示词编排、动态工具集装配、安全合规初筛、模型 Harness 调用、沙箱执行与租约自动保活。
* **对应目录与文件**：
  * **`src/core/orchestrator.ts`**
    * **文件功能**：`Orchestrator` 主类，调度 `handleTurn()` 单轮全生命周期（加载历史 -> 组装上下文 -> 模型推理 -> 工具执行 -> 审批挂起 -> 持久化落库）。
    * **依赖内容**：依赖 `src/harness/harness-router.ts`、`src/sessions/session-store.ts`、`src/security/security-screener.ts`、`src/core/orchestrator/` 辅助模块。
  * **`src/core/orchestrator/prompt-blocks.ts`**
    * **文件功能**：动态系统提示词（System Prompt）构建器，按顺序拼装环境常识、记忆快照、工具使用规范与行为守则。
    * **依赖内容**：依赖 `src/core/environment-facts.ts`、`src/types.ts`。
  * **`src/core/orchestrator/sandboxes.ts`**
    * **文件功能**：针对轮次绑定的沙箱环境按需供应、文件挂载与生命周期回收。
    * **依赖内容**：依赖 `src/sandbox/sandbox.ts`。
  * **`src/core/orchestrator/lease-keepalive.ts`**
    * **文件功能**：长耗时执行轮次的分布式会话租约（Session Lease）心跳自动保活协程。
    * **依赖内容**：依赖 `src/sessions/session-store.ts`。
  * **`src/core/orchestrator/security-screen.ts`**
    * **文件功能**：执行前输入审查与执行后工具输出检疫（Quarantine），防止提示词注入与敏感数据外泄。
    * **依赖内容**：依赖 `src/security/security-screener.ts`。
  * **`src/core/orchestrator/surface-tools.ts`**
    * **文件功能**：针对不同交互端（Web、Slack 等）动态注入特定表面专有工具集（如发送通知、请求审批）。
    * **依赖内容**：依赖 `src/tools/primitives.ts`。
  * **`src/core/orchestrator/compaction.ts`**
    * **文件功能**：超长历史上下文压缩、折叠与关键信息保留算法。
    * **依赖内容**：依赖 `src/sessions/transcript-tape.ts`。
  * **`src/core/orchestrator/turn-helpers.ts`** 与 **`src/core/orchestrator/types.ts`**
    * **文件功能**：编排器内部上下文类型定义、附件规范化与错误重构工具库。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 23. 运行时执行循环与后台 Worker 调度 (`src/runs/worker.ts`, `src/runs/run-stream.ts`, `src/core/turn-*`)
* **核心功能**：后台分布式执行 Worker 循环、执行状态机、流式输出缓冲区管理、轮次结果判定与故障重试重放。
* **对应目录与文件**：
  * **`src/runs/worker.ts`**
    * **文件功能**：异步 Worker 主循环，基于持久化队列抢占任务（Claim Lease）、心跳维持、调用编排器并在完成时原子标记状态。
    * **依赖内容**：依赖 `src/runs/run-store.ts`、`src/core/orchestrator.ts`。
  * **`src/runs/run-stream.ts`**
    * **文件功能**：内存/Redis 流式事件分发总线，缓冲单轮生成文字与工具事件并对齐 SSE 推送。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/core/turn-outcome.ts`**
    * **文件功能**：单轮执行结果分类裁定（成功、需人工审批挂起、输入等待、失败可重试、硬性拒绝）。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/core/turn-resume.ts`**
    * **文件功能**：故障/中断后会话恢复算法，跳过已完成工作节点、注入断点续传提示。
    * **依赖内容**：依赖 `src/sessions/transcript-tape.ts`。
  * **`src/core/turn-options.ts`** 与 **`src/core/turn-origin.ts`**
    * **文件功能**：轮次执行参数计算（模型档位、思考预算、超时时间）与调用溯源凭据解析。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/core/turn-error.ts`**
    * **文件功能**：业务自定义异常体系（可重试与不可重试异常分类）与用户友好错误文案抹平。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 24. 自治循环系统与工作账本 (`src/loops/`)
* **核心功能**：无人值守自主循环驱动引擎、作业项账本（Item Ledger）、动态风控熔断（Governor）、自动发版门禁与第三方集成。
* **对应目录与文件**：
  * **`src/loops/runner.ts`**
    * **文件功能**：自治循环执行器，按调度节奏拉取待办作业、启动 Agent 轮次并评估交付物。
    * **依赖内容**：依赖 `src/loops/loop-store.ts`、`src/loops/item-ledger.ts`、`src/core/orchestrator.ts`。
  * **`src/loops/loop-store.ts`**
    * **文件功能**：自治循环实体配置、状态机与绑定定时触发器的持久化管理。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/loops/item-ledger.ts`**
    * **文件功能**：自主作业项流转账本，记录输入、执行轨迹、审查反馈与最终交付物。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/loops/governor.ts`**
    * **文件功能**：自动化执行风控调节器，根据失败率、异常调用与未授权动作自动实施检疫熔断（Quarantine）。
    * **依赖内容**：依赖 `src/loops/item-ledger.ts`。
  * **`src/loops/ship-gate.ts`** 与 **`src/loops/ship-grant-store.ts`**
    * **文件功能**：自治交付自动化放行门禁与人工一次性/永久授权凭据持久化。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/loops/output-store.ts`** 与 **`src/loops/success-evaluation.ts`**
    * **文件功能**：自治生成产物暂存库与产物质量自动化裁定器。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/loops/sources/`**
    * **文件功能**：外部信号源集成适配器（支持 Gmail 邮件、Slack 消息等事件摄取驱动）。
    * **依赖内容**：依赖各外部通信协议。

---

### 25. 模型目录、凭据与多 Provider 动态网关 (`src/model/`)
* **核心功能**：多供应商模型统一元数据目录、动态 Custom Provider 注册挂载、个人与组织模型凭据加密存储与端点路由重写。
* **对应目录与文件**：
  * **`src/model/model-catalog.ts`** 与 **`src/model/gateway-catalog.ts`**
    * **文件功能**：预设大模型能力特征清单、上下文窗口、计量定价与供应商分类注册。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/model/custom-providers.ts`** 与 **`src/model/custom-provider-store.ts`**
    * **文件功能**：管理员动态接入兼容协议（OpenAI/Anthropic）的自定义大模型网关及其持久化加密库。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`、`src/credentials/keychain.ts`。
  * **`src/model/user-model-credential-store.ts`** 与 **`src/model/model-credential-store.ts`**
    * **文件功能**：支持用户自带 Key（BYOK）及组织共享模型凭据的安全加密隔离存储。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/model/provider-endpoints.ts`**
    * **文件功能**：各供应商 API 请求端点基地址统一配置与重定向覆盖。
    * **依赖内容**：依赖 `src/config.ts`。
  * **`src/model/model-verification.ts`**
    * **文件功能**：模型凭据可用性与连通性实时探针与验真机制。
    * **依赖内容**：依赖 `src/model/model-catalog.ts`。
  * **`src/model/model-overlay.ts`** 与 **`src/model/model-overlay-store.ts`**
    * **文件功能**：运行时针对特定作用域（Scope）动态覆盖模型参数与路由策略。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/model/codex-device-login.ts`**
    * **文件功能**：Codex / ChatGPT 设备代码（Device Code）免密 OAuth 登录授权桥接。
    * **依赖内容**：依赖 `node:child_process`。

---

### 26. 交互表面抽象、Slack 运行态与新用户引导 (`src/surfaces/`, `src/onboarding/`)
* **核心功能**：各客户端交互表面状态机抽象、Slack 进程内长连接/事件运行时与新成员初次互动引导流程。
* **对应目录与文件**：
  * **`src/surfaces/ui-state.ts`**
    * **文件功能**：交互界面 UI 状态快照与跨客户端渲染元数据契约。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/surfaces/slack-installation.ts`** 与 **`src/surfaces/slack-managed.ts`**
    * **文件功能**：Slack Workspace 安装凭证持久化、托管实例状态管理与多团队接入。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/surfaces/slack-runtime.ts`**
    * **文件功能**：Slack SocketMode / HTTP 事件接收循环与 Core App 轮次调度的连接桥梁。
    * **依赖内容**：依赖 `src/api/app.ts`。
  * **`src/onboarding/onboarding.ts`**
    * **文件功能**：新员工/用户首次访问时的安全问候、使用指引与默认权限预置流程。
    * **依赖内容**：依赖 `src/types.ts`、`src/sessions/session-store.ts`。

---
*(后续 Gate 6... 推进完成后，均在本文档末尾继续向下追加编写)

---
---

# Gate 6：交互 Surfaces 与产品入口层 (G6 交付全景)

### 1. Web 前端交互界面与客户端组件 (`plugins/web-ui/client/`)
* **核心功能**：现代 Web 交互界面、Lit Web Components 响应式组件库、设计系统与 CSS 变量主题、SSE 打字机多阶段渲染、代码块高亮与人工审批交互卡片。
* **对应目录与文件**：
  * **`plugins/web-ui/client/index.html`**
    * **文件功能**：Web 前端单页应用 (SPA) 宿主入口 HTML，定义视口与元数据。
    * **依赖内容**：加载 `plugins/web-ui/client/main.ts`。
  * **`plugins/web-ui/client/main.ts`**
    * **文件功能**：Web 客户端前端初始化与顶层 App 挂载入口。
    * **依赖内容**：依赖 `plugins/web-ui/client/app.ts`。
  * **`plugins/web-ui/client/app.ts`**
    * **文件功能**：Web 核心视图控制器，调度侧边栏导航、对话消息流、定时任务管理、记忆查看与 Webhook 配置等 Tab 页面切换。
    * **依赖内容**：依赖 Lit 核心库、`plugins/web-ui/client/api-client.ts`、各功能子组件。
  * **`plugins/web-ui/client/api-client.ts`**
    * **文件功能**：浏览器端与 Web UI 插件后端的异步通信客户端，支持 Fetch API 与 SSE EventSource 长连接拉取。
    * **依赖内容**：浏览器原生 Fetch 与 EventSource。
  * **`plugins/web-ui/client/theme.ts`**
    * **文件功能**：系统外观主题控制（明亮模式/暗黑模式）、调色板状态管理与本地偏好持久化。
    * **依赖内容**：无外部依赖。
  * **`plugins/web-ui/client/components/`**
    * **文件功能**：前端原子与功能组件集合，包含对话输入框 (`chat-input.ts`)、流式消息条目 (`message-view.ts`)、工具执行卡片 (`tool-card.ts`)、会话侧边栏 (`sidebar.ts`)、定时任务面板 (`crons-view.ts`)、Webhook 面板 (`webhooks-view.ts`) 与记忆查看器 (`memory-view.ts`)。
    * **依赖内容**：依赖 Lit 模板引擎、`plugins/web-ui/client/theme.ts`。

---

### 2. Web UI 插件后端服务与流式代理 (`plugins/web-ui/server/`)
* **核心功能**：Fastify Web 服务端、静态资源预压缩托管（Gzip Precompression）、请求体上限拦截（413 Body Cap）、Core API 鉴权代理、SSE 事件中继与跨成员会话共享续写控制。
* **对应目录与文件**：
  * **`plugins/web-ui/server/index.ts`**
    * **文件功能**：Web UI 插件独立进程启动入口，解析端口与环境变量并监听网络服务。
    * **依赖内容**：依赖 `plugins/web-ui/server/app.ts`。
  * **`plugins/web-ui/server/app.ts`**
    * **文件功能**：Fastify 应用实例装配，注册路由分发、错误处理中间件、预压缩静态资源托管（`@fastify/static`）与安全响应头。
    * **依赖内容**：依赖 Fastify、`plugins/chassis/core-client.ts`、`plugins/web-ui/server/routes/`。
  * **`plugins/web-ui/server/routes/turn.ts`**
    * **文件功能**：Web 端对话轮次代理入口（`POST /api/turn`），实施请求体大小防护，调用 Core 并下发初始运行状态。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。
  * **`plugins/web-ui/server/routes/events.ts`**
    * **文件功能**：实时 SSE 打字机流式中继路由（`GET /api/runs/:runId/events`），将 Core 的思考过程、工具调用与终态响应透传至浏览器。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。
  * **`plugins/web-ui/server/routes/crons.ts`** 与 **`plugins/web-ui/server/routes/webhooks.ts`**
    * **文件功能**：定时任务与外部 Webhook 的 Web 端管理代理，执行用户身份绑定与权限隔离。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。
  * **`plugins/web-ui/server/routes/memory.ts`**
    * **文件功能**：用户个人记忆与工作区 Notebook 读写管理路由。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。
  * **`plugins/web-ui/server/routes/threads.ts`**
    * **文件功能**：会话历史拉取与团队成员共享线程权限校验（同频道可续写，局外人严禁访问）。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。

---

### 3. Admin 管理控制台与全景配置中心 (`plugins/admin/`)
* **核心功能**：管理员控制台前后台全套实现，涵盖组织全局策略配置、模型端点与目录热插拔、Slack 安装接入与双向活跃度追踪、历史转录带回放与 MCP 服务管理。
* **对应目录与文件**：
  * **`plugins/admin/src/index.ts`** 与 **`plugins/admin/src/app.ts`**
    * **文件功能**：Admin 插件服务入口与 Fastify 实例构建，配置管理员会话鉴权与路由分发。
    * **依赖内容**：依赖 Fastify、`plugins/chassis/core-client.ts`。
  * **`plugins/admin/src/routes/`**
    * **文件功能**：Admin 专用 REST API 集合，包括作用域配置 (`scope-config.ts`)、模型供应商设置 (`settings-providers.ts`)、Slack 镜像观测 (`slack-mirror.ts`)、用户权限流转 (`users.ts`)、MCP 服务器注册 (`mcp-servers.ts`) 等。
    * **依赖内容**：依赖 `plugins/chassis/core-client.ts`。
  * **`plugins/admin/ui/`**
    * **文件功能**：基于 Lit 的管理员控制台前端 UI 组件，包括：
      * `settings.ts`: 组织和作用域高级系统参数配置视图；
      * `slack-installation.ts`: Slack 应用安装状态、OAuth 授权流与连接探针；
      * `slack-activity.ts`: Slack 交互活跃度、投递失败率与重试链路统计；
      * `slack-mirror.ts`: Slack 历史频道消息镜像时间线观测与全文检索；
      * `transcript.ts`: 对话转录磁带（Session Tape）可视化审计与排障查看器；
      * `artifacts.ts`: 知识构件、技能包与文件资产全生命周期管理面板。
    * **依赖内容**：依赖 Lit 核心库、Lit Html 模板。

---

### 4. Portal 统一认证、身份防伪与反向代理网关 (`plugins/portal/`)
* **核心功能**：企业级入口反向代理、SSO 认证集成、基于 HMAC-SHA256 的 Portal Identity 防伪加签、HTTPS 动态协议支持与安全受限路由访问保护。
* **对应目录与文件**：
  * **`plugins/portal/src/index.ts`**
    * **文件功能**：Portal 独立服务入口，启动主 HTTP/HTTPS 网关服务。
    * **依赖内容**：依赖 `plugins/portal/src/server.ts`。
  * **`plugins/portal/src/server.ts`**
    * **文件功能**：Portal 原生 HTTP 请求调度中枢，协调路由分发、Cookie 提取、登录重定向与上游代理转发。
    * **依赖内容**：依赖 `plugins/portal/src/proxy.ts`、`plugins/portal/src/identity.ts`。
  * **`plugins/portal/src/proxy.ts`**
    * **文件功能**：高性能双工反向代理实现，支持安全请求头透传、协议动态判断（支持 HTTP 与 HTTPS 上游）、跨源 Frame 策略维护与流式响应传输。
    * **依赖内容**：依赖 `node:http`、`node:https`、`plugins/chassis/core-client.ts`、`plugins/chassis/portal-identity.ts`。
  * **`plugins/portal/src/identity.ts`**
    * **文件功能**：基于 Cookie、OAuth 凭据与内部断言解析当前访问者的权威身份（Principal），并生成短时有效的防伪票据。
    * **依赖内容**：依赖 `plugins/chassis/portal-identity.ts`。

---

### 5. Plugin Chassis 通信签名底座 (`plugins/chassis/`)
* **核心功能**：Plugin 与 Core 之间的免编译、零循环引用的标准通信脚手架，保证分布式微服务架构下的密码学安全与身份互信。
* **对应目录与文件**：
  * **`plugins/chassis/src/core-client.ts`**
    * **文件功能**：Plugin 发起与 Core 交互的标准客户端，自动计算时间戳防重放并追加 HMAC-SHA256 签名报头。
    * **依赖内容**：依赖 `plugins/chassis/src/source-auth-sign.ts`、`node:http`、`node:https`。
  * **`plugins/chassis/src/source-auth-sign.ts`**
    * **文件功能**：核心签名生成器，使用共享密钥对 HTTP 方法、路径与请求体进行密码学生成。
    * **依赖内容**：依赖 `node:crypto`。
  * **`plugins/chassis/src/portal-identity.ts`**
    * **文件功能**：Portal 权威身份令牌（`x-qm-portal-identity`）的签发（`mintPortalIdentity`）与校验（`verifyPortalIdentity`）引擎，带 60s TTL 防伪保护。
    * **依赖内容**：依赖 `node:crypto`。
  * **`plugins/chassis/src/errors.ts`**
    * **文件功能**：插件跨端通信的通用错误结构体包装与安全状态码提取。
    * **依赖内容**：无外部依赖。

---

### 6. Slack 核心交互协议与消息网关 (`src/slack/`)
* **核心功能**：Slack 完整交互表面实现，含双工 SocketMode / HTTP 事件网关、消息防重投递幂等去重、交互式审批卡片、表情 Reaction 状态迁移与频道上下文全量镜像。
* **对应目录与文件**：
  * **`src/slack/runtime.ts`**
    * **文件功能**：Slack 核心运行态生命周期管理器，管理 WebSocket 客户端连接、自动心跳保活、断线重连与动态凭据重新装载。
    * **依赖内容**：依赖 `@slack/socket-mode`、`src/slack/turn-handler.ts`、`src/slack/events-proxy.ts`。
  * **`src/slack/http-events.ts`** 与 **`src/slack/events-proxy.ts`**
    * **文件功能**：Slack HTTP Webhook 签名验证（`x-slack-signature`）、请求防篡改校验与事件代理转发。
    * **依赖内容**：依赖 `node:crypto`、`src/slack/events.ts`。
  * **`src/slack/turn-handler.ts`**
    * **文件功能**：接收来自 Slack 的消息输入，完成用户身份映射、频道权限感知，并组装为标准 Turn 请求派发给 Core 编排器。
    * **依赖内容**：依赖 `src/api/app.ts`、`src/slack/presenters.ts`。
  * **`src/slack/delivery.ts`** 与 **`src/slack/deliveries.ts`**
    * **文件功能**：Agent 执行结果向 Slack 频道的可靠投递器，实现行锁排他抢占、网络抖动重试与消息格式 Markdown 转译。
    * **依赖内容**：依赖 `src/delivery/delivery-store.ts`、`src/slack/mrkdwn.ts`。
  * **`src/slack/delivery-claim-race.ts`** 与 **`src/slack/redelivery-dedup.ts`**
    * **文件功能**：分布式并发场景下的投递认领防冲突裁决与 Slack 重复事件（相同 `client_msg_id`）幂等过滤。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/slack/approval-cards.ts`** 与 **`src/slack/approval-context.ts`**
    * **文件功能**：交互式 Block Kit 审批卡片生成器，向管理员呈现敏感工具调用详情，并支持一键通过/拒绝交互。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/slack/approval-repost.ts`** 与 **`src/slack/approvals-quarantine.ts`**
    * **文件功能**：超时审批卡片原位重新催办刷新与高危操作隔离检疫安全提醒。
    * **依赖内容**：依赖 `src/slack/approval-cards.ts`。
  * **`src/slack/reactions.ts`** 与 **`src/slack/ack-emoji.ts`**
    * **文件功能**：基于表情符号（Emoji）的任务生命周期状态机推进（如收到任务打勾、处理中打眼睛、完成打礼花），支持租约丢失安全回滚。
    * **依赖内容**：依赖 `src/types.ts`。
  * **`src/slack/task-ack.ts`** 与 **`src/slack/deferred-ack.ts`**
    * **文件功能**：长任务先期临时确认消息派发，避免 Slack 3秒超时告警，后续自动衔接真实业务响应。
    * **依赖内容**：依赖 `src/slack/delivery.ts`。
  * **`src/slack/mirror/`** (包含 `mirror-service.ts`, `ingest.ts`, `store.ts`, `search.ts`)
    * **文件功能**：频道历史消息双向持续镜像同步、全量归档、PostgreSQL 全文索引维护与毫秒级历史记录检索。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`、`src/directory/directory-store.ts`。
  * **`src/slack/mrkdwn.ts`** 与 **`src/slack/presenters.ts`**
    * **文件功能**：标准 CommonMark 到 Slack Mrkdwn 格式的转义与美化，处理富文本链接、用户 Mention 标签与高亮代码块。
    * **依赖内容**：无外部依赖。
  * **`src/slack/refusals.ts`** 与 **`src/slack/rate-limit-notice.ts`**
    * **文件功能**：合规拦截、外部访客访问受限与速率限制友善告警文案生成。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 7. 交互表面基础抽象与凭证管理 (`src/surfaces/`)
* **核心功能**：交互表面生命周期基类、Slack Workspace 授权凭证持久化与多租户托管多组织路由。
* **对应目录与文件**：
  * **`src/surfaces/slack-installation.ts`**
    * **文件功能**：Slack App 安装记录、Bot Token、User Token 与凭据更新持久化存储。
    * **依赖内容**：依赖 `src/persistence/pg-pool.ts`。
  * **`src/surfaces/slack-managed.ts`**
    * **文件功能**：受托管多组织 Slack 接入点服务状态管理。
    * **依赖内容**：依赖 `src/surfaces/slack-installation.ts`。
  * **`src/surfaces/ui-state.ts`**
    * **文件功能**：跨表面客户端通用的 UI 渲染状态与指示器数据结构。
    * **依赖内容**：依赖 `src/types.ts`。

---

### 8. CLI 镜像清单与多云环境部署配置 (`cli/`)
* **核心功能**：多环境容器构建镜像清单管理，驱动 Docker、AWS、Fly 等多云环境的标准化部署。
* **对应目录与文件**：
  * **`cli/manifest.json`**
    * **文件功能**：声明 Core、Web UI、Admin、Portal、Auth 各微服务及沙箱基础镜像的 SHA-256 Digest 锁版本配置。
    * **依赖内容**：由 CI 镜像流水线构建产出。
  * **`cli/src/manifest.ts`**
    * **文件功能**：CLI 端镜像清单加载器，解析服务镜像引用并校验 SHA-256 Digest 完整性。
    * **依赖内容**：依赖 `cli/manifest.json`、`node:fs`。

