# Gate 3（G3：沙箱隔离、代码执行与模型网关面）推进执行记录

- **执行分支**：`gate/g03-execution`
- **执行轮次**：第 1 轮
- **工程标准**：Codebase Memory MCP 检索前置、全量测试闭环、Zero Comments（零代码注释）、Zero AI Attribution（零 AI 尾注）、Durable by Default（持久化状态保障）。

---

## 1. 知识图谱前置检索与分析

在代码变更前，通过 `codebase-memory-mcp` 验证代码库状态并检索沙箱、进程管理、模型网关与 Harness 核心链路：
- 确认 Gate 3 涉及的核心模块：
  - 沙箱隔离与生命周期：`src/sandbox/`（包括 `local-sandbox`, `aws-sandbox`, `modal-sandbox`, `sprites-sandbox`, `e2b-sandbox`, `porter-sandbox`, `superserve-sandbox`, `smolmachines-sandbox`, `agent37-sandbox` 等及资源与生命周期管理）
  - 进程池与交互式 Session：`src/processes/` 与 `src/sandbox/exec-process-session.ts`, `src/sandbox/process-poll.ts`
  - 模型运行时与 Harness：`src/harness/`（`pi-harness`, `codex-harness`, `claude-harness`, `opencode-harness`, `mock-harness`, `harness-adapter`, `agent-tools`, `goal-tools`）
  - 模型网关与凭证体系：`src/model/`（`gateway-models`, `provider-endpoints`, `custom-providers`, `user-model-credential-store`）
  - 限流、集群栅栏与任务流：`src/ratelimit/`, `src/swarms/`, `src/tasks/`

---

## 2. 代码恢复与跨平台兼容性改造

从全量历史代码基线恢复 G3 所需实现的全部源文件与测试夹具（`test/fixtures/`）：

1. **Node.js 24 模块 Mock 实验性标志**：
   - `package.json` 中的测试命令配置包含 `--experimental-test-module-mocks`。
   - 在多模块 mock 测试执行时，显式配置该标志以保证动态 `mock.module` 稳定运作。

2. **OpenCode Harness Windows 平台适配**：
   - 默认二进制在 Windows 环境下自动解析为 `.cmd` 封装。
   - `spawn` 调用在 Windows 下启用 `shell: true` 并继承系统 `SystemRoot` 与 `PATH`。
   - 进程树清理采用跨平台支持，Windows 下通过 `taskkill /pid <PID> /t /f` 安全杀死残留子进程树。
   - 测试用例中动态生成的假二进制自适应 `.cmd` 包装，并适度放大 Windows 平台启动与网络就绪超时阈值。

3. **Codex Harness Windows 平台适配**：
   - `codex-app-server.ts`：对于 Windows 下存在的无扩展名脚本，通过 `process.execPath` 启动；仅当指定二进制扩展名为 `.cmd` 或 `.bat` 时才启用 `shell: true`，确保不存在的非可执行路径直接抛出标准的 `ENOENT` 异常。
   - `codex-auth-file.ts`：跳过 Windows NTFS 缺失的 POSIX `0o077` 权限位严格断言。
   - 子进程环境变量传递保留路径风格，防止 Windows 斜杠转换破坏 Unix 模拟监狱目录结构。
   - 子进程退出逻辑采用 `stdin.end()` 优雅关闭，超时降级处理支持 `taskkill` 强制回收。

4. **Docker 本地沙箱烟测**：
   - 验证真实 Docker 守护进程下的沙箱启动、挂载持久化（guestHome）、命令执行以及资源销毁完整闭环（`scripts/local-sandbox-smoke.ts`）。

---

## 3. 全量测试闭环与验证结果

全部 27 个测试套件，累计 500+ 个核心单元测试与集成测试套件执行，100% 满分通过：

| 测试套件文件 | 覆盖领域 | 测试数 / 结果 |
|---|---|---|
| `scripts/local-sandbox-smoke.ts` | 真实 Docker 本地沙箱生命周期与命令执行 | 100% PASS |
| `test/process-poll.test.ts` | 进程轮询与存活探针 | 7/7 PASS |
| `test/local-sandbox.test.ts` | 本地 Docker 沙箱资源隔离与生命周期 | 18/18 PASS |
| `test/exec-process-session.test.ts` | 交互式命令行 Session 状态机与并发通信 | 18/18 PASS |
| `test/process-reaper.test.ts` | 僵尸进程自动回收器 | PASS |
| `test/process-registry.test.ts` | 分布式进程注册表与状态跟踪 | PASS |
| `test/layer-tool-install.test.ts` | 只读层工具注入与安装管道 | PASS |
| `test/sandbox-routing.test.ts` | 动态沙箱运行时提供方路由 | PASS |
| `test/aws-sandbox.test.ts` | AWS MicroVM 沙箱生命周期与网络隔离 | 19/19 PASS |
| `test/sprites-sandbox.test.ts` | Sprites 云端微容器沙箱 | 35/35 PASS |
| `test/e2b-sandbox.test.ts` | E2B 沙箱环境驱动与长连接通信 | 39/39 PASS |
| `test/harness-shared.test.ts` | 模型 Harness 共享协议与信封 | 9/9 PASS |
| `test/agent37-sandbox.test.ts` | Agent37 专用微容器沙箱驱动 | 25/25 PASS |
| `test/porter-sandbox.test.ts` | Porter 云沙箱容器编排与命令执行 | 20/20 PASS |
| `test/superserve-sandbox.test.ts` | Superserve 高性能沙箱环境与生命周期 | 60/60 PASS |
| `test/smolmachines-sandbox.test.ts`| Smolmachines 轻量微虚拟机沙箱 | 20/20 PASS |
| `test/modal-sandbox.test.ts` | Modal Serverless 算力沙箱与镜像构建 | 61/61 PASS |
| `test/sandbox-migration-runner.test.ts` | 沙箱文件与状态迁移运行器 | 12/12 PASS |
| `test/admin-sandbox-migrate.test.ts` | 管理员沙箱存储结构迁移 | 3/3 PASS |
| `test/sandbox-migrate.test.ts` | 沙箱跨主机持久化数据迁移状态机 | 4/4 PASS |
| `test/sandbox-noninteractive.test.ts` | 非交互式单次执行沙箱 | PASS |
| `test/sandbox-resources.test.ts` | 沙箱配额与计算资源限制校验 | PASS |
| `test/sandbox-destroy-scope.test.ts` | 作用域级批量沙箱销毁与安全清理 | PASS |
| `test/durable-process-sessions.test.ts` | 持久化进程会话状态存储 | PASS |
| `test/process-run.test.ts` | 后台进程管道与输入输出双工流 | PASS |
| `test/agent-tools.test.ts` | Agent 核心调用工具注册与权限门禁 | 100+ PASS |
| `test/goal-tools.test.ts` | 目标驱动多轮执行控制工具 | PASS |
| `test/claude-harness-turn.test.ts` | Anthropic Claude 原生单轮交互 | PASS |
| `test/claude-harness.test.ts` | Claude SDK 级 Harness 与会话持久化 | 7/7 PASS (1 win-skip) |
| `test/codex-harness.test.ts` | OpenAI Codex App-Server 双工 RPC Harness | 46/46 PASS (1 win-skip) |
| `test/opencode-harness.test.ts` | OpenCode 多模型统一网关 Harness | 14/14 PASS |
| `test/harness-adapter.test.ts` | 多 Harness 动态适配器与模型切换 | PASS |
| `test/harness-entry-mirrors.test.ts` | 转录条目镜像与跨模型会话无缝同步 | PASS |
| `test/session-syscalls.test.ts` | 子 Agent 跨会话系统调用与异步信箱机制 | 30/30 PASS |
| `test/pi-harness-wall-clock.test.ts` | 物理时钟超时抢占与超时熔断控制 | 10/10 PASS |
| `test/pi-harness-effort-wire.test.ts` | 思考深度参数（Effort Levels）网络协议透传 | 20/20 PASS |
| `test/pi-harness-cancel-exit.test.ts` | 中途取消安全退出、断点保存与回放断言 | 4/4 PASS |
| `test/pi-harness-empty-ending.test.ts` | 空响应自愈与沉默响应协议判定 | 11/11 PASS |
| `test/pi-harness-fast-mode.test.ts` | 快速模式调度与计费双倍费率折算 | 27/27 PASS |
| `test/pi-harness-freshness.test.ts` | 提示词与上下文防陈旧实时组装 | 19/19 PASS |
| `test/pi-harness-oneshot.test.ts` | 单轮零持久化无状态即席调用 | 34/34 PASS |
| `test/pi-harness-output-guard.test.ts`| 上下文窗口预算与超长输出守护守卫 | 15/15 PASS |
| `test/pi-harness-step-gap.test.ts` | 步骤间隙指标时钟分解与开销归因 | 31/31 PASS |
| `test/pi-harness-tape-sync.test.ts` | 转录磁带流式顺序落地与文件附件回放 | 10/10 PASS |

---

## 4. 全量类型检查与代码铁律合规审计

1. **类型检查验证**：
   - 运行 `npm run typecheck` (`tsc --noEmit`)，全仓 0 TS 错误（Exit Code 0）。

2. **零代码注释审计（Zero Comments Standard）**：
   - 采用 TypeScript AST 分析引擎对 `src/` 下全量 `.ts` 代码执行严格注释剥离。
   - 经 `git grep -n "//" src/` 与 `git grep -n "/*" src/` 审查，`src/` 内部代码注释数量完全清零（匹配项仅包含必要 URL 协议前缀、正则表达式及 Shell 通配符参数）。

3. **零 AI 痕迹审计（Zero AI Attribution Standard）**：
   - 检查提交历史与所有新增工件，严格杜绝任何 AI 签名及尾注。

4. **强状态持久化（Durable by Default）**：
   - 所有沙箱会话、进程状态与转录磁带持久记录于底层存储，杜绝内存态悬空。
