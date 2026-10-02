# Gate 7 推进记录（第一轮）：全仓恢复与全量生态对齐

- **执行分支**: `gate/g07-repo`
- **对齐目标**: 补齐上游基准版本中的全部剩余内容，彻底恢复 QM 完整源码树、多云部署驱动（Fly/AWS/Porter/Docker/Shared）、CLI 命令行工具链、CI/CD 自动化工作流、种子技能资产与全量测试套件生态，实现全仓无死角对齐。
- **验收目标标签**: `gate/g07-pass`

---

## 一、知识图谱初始化与索引状态 (Codebase Memory)

在开展代码修复与测试验证前，通过 `codebase-memory-mcp` 对当前工作区完成全量索引构建与拓扑探测：
- **项目名**: `C-Users-root-orca-workspaces-qm-rebuild-gate-g07-complete`
- **图谱规模**: 30,789 个节点 (Nodes)，149,173 条调用与从属边 (Edges)
- **分析调用链**: 全面解析 CLI 命令调度流（`cli/src/index.ts` -> 各 command handler）、多云部署驱动提供商（`src/deploy/*` 与 `cli/src/*-deploy-provider`）及沙箱隔离拓扑。

---

## 二、测试套件全量执行与修复闭环

### 1. CLI 命令行工具链测试 (`cli/test/*.test.ts`)
- **执行结果**: 41 个测试套件，332/332 测试用例全部通过（100% Pass）。
- **关键覆盖项**:
  - `doctor.test.ts` (27/27 passed)
  - `fly-sandbox.test.ts` (30/30 passed)
  - `init.test.ts` (17/17 passed)
  - `aws.test.ts` (工作负载过渡门控与异步巡检全部通过)
  - `deployment-layer.test.ts`, `docker-secrets.test.ts`, `package.test.ts`, `util.test.ts` 全部通过。

### 2. 核心与系统测试 (`test/`)
- **关键问题突破**:
  - **`dev-supervisor-child.test.ts`**: Windows 环境下无 `lsof` 命令，重构 `portHolders` 采用 `netstat -ano -p tcp` 提取监听端口 PID，并在进程清理阶段适配 `taskkill /F /T /PID` 树形终止。
  - **`device-flow-persist.test.ts`**:
    1. Windows MSYS bash 运行 `tar` 时遇到冒号驱动器路径（`C:/...`）会被误判为远程 rsh tape 导致归档文件为空。在 `fake-sprites` 仿真环境中于 PATH 前置植入 `tar` 包装垫片（自动附带 `--force-local`），彻底消除子脚本执行异常。
    2. MSYS 环境下 `readlink` 返回 `/c/...` 格式，修正 `removeDeviceFlowLogins` 的临时隔离清理模式，增加 `*"/agent-creds/"*` 通配以兼容多平台符号链接解析。
    3. Windows NTFS 文件系统不具备原生 POSIX 0600 权限位，MSYS `stat` 读取为 644/755，修正相应测试中基于平台的模式断言。
  - **结果**: 全量 42 个用例 100% 全部通过。

### 3. 各插件测试套件 (`plugins/*/test`)
- **`plugins/admin`**: 227/227 测试用例全部通过。
- **`plugins/auth`**: 66/66 测试用例全部通过。
- **`plugins/portal`**: 155/155 测试用例全部通过（5 个按规格跳过）。
- **`plugins/web-ui`**: 1,389/1,389 测试用例全部通过。

---

## 三、类型检查与生产环境构建

1. **TypeScript 类型检查 (`npm run typecheck`)**:
   - 修复 `scripts/dev/lib/proc.ts` 中 `noUncheckedIndexedAccess` 触发的 `parts[1]?.endsWith` 潜在 undefined 问题。
   - 主仓 `npm run typecheck`: 0 错误通过。
   - CLI `npm --prefix cli run typecheck`: 0 错误通过。
   - 所有插件 `admin` / `auth` / `portal` / `web-ui` typecheck: 0 错误通过。

2. **生产环境构建**:
   - `plugins/web-ui`: Vite 构建成功产出 `dist-web`（4862 个模块成功转换）。
   - `cli`: `tsc -p tsconfig.build.json` 成功编译构建。

---

## 四、工程铁律遵守审计

- **Zero Comments**: `src/` 与 `cli/src/` 无任何新增解释性注释、JSDoc、TODO 或被注释代码。
- **Zero AI Attribution**: 提交信息与代码中无任何 AI 生成标签或 `Co-authored-by` 尾注。
- **Durable by Default**: 所有凭据持久化、状态机流转与任务队列全面接入底层持久化存储。
