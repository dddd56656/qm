# gate/g02-walkthrough - 第 2 轮推进记录

## 1. 本轮推进背景与定位
- **对应阶段**：Gate 2 - 步骤 4（Step 4: 会话状态机、时序转录带与任务信箱系统调用）
- **当前分支**：`gate/g02-walkthrough`
- **MCP 接入机制**：在执行前通过 `codebase-memory-mcp` 的 `query_graph` 查询现有会话与运行相关函数，核验符号拓扑，确保上下文认知对齐。

---

## 2. 本轮引入的核心目录与文件清单

### `src/sessions/`（会话状态机与转录带核心）
1. `session-store.ts`：会话核心抽象接口与数据结构。定义单调自增序号 `seq`、四状态机（`idle`, `working`, `awaiting_input`, `error`）以及参与者时间窗口 `ParticipantTenure`。
2. `postgres-session-store.ts`：PostgreSQL 会话持久化实现。实现强一致行锁、`session_entries` 时序追加写与快照恢复。
3. `memory-session-store.ts`：会话内存实现，供快速本地单元测试与无状态单机测试使用。
4. `session-syscalls.ts`：会话系统调用接口（`open`, `write`, `read`, `wait`），支持多层级子智能体任务派生与信箱投递。
5. `session-mailbox.ts`：子智能体任务信箱。子任务执行完毕后将最终答案打包为信封回传给父会话，无需父进程主动轮询。
6. `entry-search.ts` & `history-search.ts`：转录带全文检索与时间轴倒查引擎。
7. `session-share.ts`：跨作用域安全分享机制。

### `src/runs/`（任务执行流与工作进程）
1. `postgres-run-store.ts` & `memory-run-store.ts`：单轮 Run 状态持久化。
2. `worker.ts` & `worker-main.ts`：后台任务执行 Worker 进程入口。
3. `turn-stream.ts` & `run-stream-events.ts`：流式打字机事件分发。
4. `background-controller.ts` & `background-ownership.ts`：后台长任务所有权与守护。
5. `reaper.ts`：僵尸任务回收器，强制释放死锁租约。

### 辅助控制面
1. `src/triggers/provenance.ts`：任务触发溯源链元数据。
2. `src/core/turn-origin.ts` & `src/core/turn-error.ts`：单轮会话来源与错误分类。
3. `src/api/routes/admin/origins.ts`：管理员会话溯源端点。

---

## 3. 运行验证与测试结果
- **执行命令**：
  ```bash
  $env:DATABASE_URL="postgres://postgres:qm-dev@127.0.0.1:55432/qm_dev_17c43fbe33e1"; node --test --test-concurrency=1 test/postgres-broker-sessions.test.ts test/postgres-run-activity-store.test.ts test/postgres-run-stream.test.ts test/session-state-bus.test.ts test/session-store.test.ts test/session-syscalls.test.ts
  ```
- **核心验证项**：
  1. `test/postgres-broker-sessions.test.ts`：跨实例浏览器授权会话持久化与严格过期回收。
  2. `test/postgres-run-activity-store.test.ts`：多实例到达时序严格单调一致性。
  3. `test/postgres-run-stream.test.ts`：PostgreSQL 双向流式打字机事件中继与重放。
  4. `test/session-state-bus.test.ts`：会话状态总线事件扇出广播。
  5. `test/session-store.test.ts`：单调递增 `seq`、参与者在场窗口遮光罩（历史消息不可见）、续租心跳与僵尸任务释放。
  6. `test/session-syscalls.test.ts`：子会话派生、任务限流配额、Mailbox 异步信封投递与父子隔离。
- **测试结果**：**86 / 86 PASS (100% 通过，耗时 17.5s)**。

---

## 4. 架构设计关键亮点总结
- **在场时间窗隔离（Participant Tenure Window）**：
  新成员进群只能看到 `[valid_from_seq, ...]` 以后的新对话，退群后无法读取 `[..., valid_to_seq]` 之后的未来内容，杜绝越权窃听。
- **Mailbox 异步信封机制**：
  子 Agent 在独立会话中处理复杂任务，产出答案后通过 `session-mailbox` 封装为不可变信封递回父会话，彻底避免内存共享冲突。
- **Zero Comments 铁律**：
  全量代码零解释性注释，意图通过架构分层与 86 项测试完全表达。
