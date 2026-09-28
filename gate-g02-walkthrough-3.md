# gate/g02-walkthrough - 第 3 轮推进记录

## 1. 本轮推进背景与定位
- **对应阶段**：Gate 2 - 步骤 5 与步骤 6 全量闭环（文件资产库、工作区持久化、运维审计与开箱 Schema 迁移总回归）
- **当前分支**：`gate/g02-walkthrough`
- **MCP 接入机制**：在执行前通过 `codebase-memory-mcp` 查询全仓 209 个模块的拓扑状态，严格保证零循环依赖与自底向上单向依赖。

---

## 2. 本轮引入的核心目录与文件清单

### `src/files/`（文件与资产仓库）
1. `file-artifact-store.ts` & `postgres-file-artifact-store.ts`：租户文件隔离仓库、SHA-256 哈希校验、权限句柄解析与并发删除防护。
2. `file-upload-store.ts`：大文件分片断点续传状态机、过期租约轮转清理与配额管理。
3. `direct-file-upload.ts`：前端直接上传通道协议。
4. `durable-byte-store.ts`：底层二进制流持久化抽象接口。
5. `upload-client.py`：客户端上传脚本工具。

### `src/workspace/` & `src/environments/`（工作区与运行环境映射）
1. `src/workspace/workspace-store.ts`：结合 G1 架构规范的物理工作区映射。
2. `src/environments/environment-store.ts`：多租户环境变量安全存储。

### `src/admin/` & `src/audit/`（运维审计与指标 Sink）
1. `src/admin/postgres-audit-log.ts` & `src/audit/audit-log.ts`：按 ScopeId 追踪的关键权限变更、文件访问记录与时间轴倒查。
2. `src/admin/postgres-error-log.ts` & `src/admin/error-log.ts`：生产级异常堆栈与事件持久化。
3. `src/admin/postgres-metrics-sink.ts` & `src/admin/metrics-sink.ts`：时序采样监控度量存储。
4. `src/admin/postgres-credential-usage-sink.ts` & `src/admin/postgres-egress-audit-sink.ts`：凭据消费与网络出站审计。
5. `src/admin/admin-service.ts`：管理后台运维核心聚合服务。

### 自动化迁移与开箱运行
1. `scripts/migrate.mjs`：全库 16 大持久化模块及 DurableMap 迁移注册与一键应用脚本。
2. `package.json`：注册 `"migrate": "node scripts/migrate.mjs"`。

---

## 3. 运行验证与测试结果
1. **Schema 迁移一键初始化**：
   ```bash
   npm run migrate
   # 输出：[qm:migrate] database migrations applied: 57 migrations recorded, 49 tables ready
   ```
2. **全量 28 套件端到端串行回归**：
   - 包含：`util-crypto`, `util-shell`, `util-text`, `acl-resource-prefix`, `acl-membership-manage`, `acl-conditional-replace`, `identity`, `directory-store`, `resolution`, `leader-lease`, `persistence-init-retry`, `postgres-migrations`, `postgres-listener`, `postgres-broker-sessions`, `postgres-run-activity-store`, `postgres-run-stream`, `session-state-bus`, `session-store`, `session-syscalls`, `postgres-admin-grants`, `postgres-grant-store`, `postgres-directory-store`, `postgres-audit-log`, `postgres-error-log`, `postgres-metrics-sink`, `postgres-file-artifact-store`, `postgres-file-upload-store`, `postgres-config-store`。
   - **测试结果**：**261 / 261 PASS (100% 满分通过，耗时 153.6s)**。

---

## 4. 架构原则遵循情况
- **Zero Comments 铁律**：所有新增 `.ts` 文件经过注释扫描，保持 0 解释性代码注释。
- **Durable by Default**：所有会话、文件、权限、配置、指标全部落地真实 PostgreSQL 数据库（49 张物理数据表）。
