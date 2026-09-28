# gate/g02-walkthrough - 第 1 轮推进记录

## 1. 本轮推进背景与定位
- **对应阶段**：Gate 2 - 步骤 3（Step 3: PostgreSQL 基础持久化底座、分布式抢麦单写租约与跨节点通知）
- **当前分支**：`gate/g02-walkthrough`
- **MCP 接入状态**：`codebase-memory-mcp` 已全量索引（4383 个节点、8015 条边，包含 1026 个函数、233 个接口），每次模型调用前均优先使用知识图谱查询。

---

## 2. 本轮引入的核心目录与文件清单

### `src/persistence/`（持久化与分布式控制底座）
1. `pg-pool.ts`：统一封装 Node.js `pg.Pool`，实现 57 项增量 Schema 迁移引擎与事务 Advisory Lock 排他控制。
2. `leader-lease.ts`：分布式会话单写者抢麦租约。实现 `acquireLease`、`renewLease` 心跳续租、超时自愈与 Reaper 强制接管。
3. `advisory-lock.ts`：基于 PostgreSQL 行级/事务级 `pg_advisory_xact_lock` 的互斥锁抽象。
4. `durable-map.ts`：版本化持久 KV 存储，强制清洗 NUL 字符（`\u0000`）防止损坏 Postgres JSONB。
5. `postgres-listener.ts`：基于 PostgreSQL 原生 `LISTEN/NOTIFY` 实现跨实例毫秒级实时状态广播与断线重连同步。
6. `postgres-notify-bus.ts`：跨节点信号发布订阅通道封装。
7. `blob-transfer.ts` & `s3.ts`：大文件与对象存储流式读写适配器。

### 关联辅助模块
1. `src/admin/admin-grant-store.ts` & `src/admin/postgres-admin-grant-store.ts`：管理员专属授权存储。
2. `src/runs/run-signal-store.ts` & `src/runs/postgres-run-signal-store.ts`：任务唤醒信号存储。

---

## 3. 运行验证与测试结果
- **执行命令**：
  ```bash
  node --test --test-concurrency=1 test/leader-lease.test.ts test/persistence-init-retry.test.ts test/postgres-migrations.test.ts test/postgres-listener.test.ts
  ```
- **验证项**：
  1. `test/leader-lease.test.ts`：验证分布式抢麦锁排他性、崩溃断网自动让渡锁与死锁自愈。
  2. `test/persistence-init-retry.test.ts`：验证数据库不可用时自动重试且不污染连接池。
  3. `test/postgres-migrations.test.ts`：验证多节点并发升级时迁移执行且仅执行一次、损坏回滚。
  4. `test/postgres-listener.test.ts`：验证 LISTEN/NOTIFY 跨节点实时唤醒与断网重连全量 resync。
- **测试结果**：**23 / 23 PASS (100% 通过，耗时 7.1s)**。

---

## 4. 架构原则遵循情况
- **Codebase Memory MCP 优先**：调用前先查图谱，精准获悉图谱函数与依赖。
- **Zero Comments**：所有 `.ts` 源码 0 代码注释，意图通过架构设计与测试用例表达。
- **Durable by Default**：所有会话锁、配置与版本全面落地到本地 PostgreSQL 容器（`127.0.0.1:55432`）。
