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
*(后续 Gate 3、Gate 4... 推进完成后，均在本文档末尾继续向下追加编写)*
