# Gate 6 推进与验收记录文档 (gate-g06-surfaces-1.md)

## 1. 阶段定位与工作分支
- **门控阶段**：Gate 6 (G6: 交互 Surfaces 与产品入口层)
- **目标**：恢复用户和管理员实际使用 QM 的产品入口与交互表面（Surfaces），打通 Web UI、Admin 管理后台、Portal 认证网关、Plugin Chassis 客户端底座以及 Core 进程内 Slack 交互协议全链路。
- **模块范围**：
  - `plugins/web-ui/`：Web 前端 SPA 交互界面与 Fastify 后端流式服务
  - `plugins/admin/`：系统管理控制台
  - `plugins/portal/`：用户统一认证、身份防伪加签与反向代理网关
  - `plugins/chassis/`：Plugin 与 Core 通信签名与安全客户端
  - `src/slack/`：Slack 消息收发、事件网关、审批卡片、Reaction 处理与运行时
  - `src/surfaces/`：交互表面基础抽象与安装凭据底座
  - `cli/`：多环境部署镜像清单与管理工具
  - 全量相关测试套件：`test/*slack*.test.ts`, `test/web-ui-*.test.ts`, `test/admin-*.test.ts`, `test/portal-*.test.ts`, `test/surface-*.test.ts`
- **工作分支**：`gate/g06-surfaces`
- **目标封存标签**：`gate/g06-pass`

---

## 2. 依赖与环境准备
- **前置基线接入**：以 `git merge --ff-only gate/g05-pass` 保证完整承接 G5（执行与持久化底盘）全部状态与数据表迁移。
- **环境与依赖安装**：
  - 启动 PostgreSQL 17 开发数据库容器 `qm-dev-postgres` (`127.0.0.1:55432`)
  - 根工程执行 `npm ci --ignore-scripts`
  - 插件子包分别完成完整依赖安装：
    - `plugins/admin`: `npm ci --ignore-scripts`
    - `plugins/portal`: `npm ci --ignore-scripts`
    - `plugins/web-ui`: `npm ci --ignore-scripts`
    - `plugins/auth`: `npm ci --ignore-scripts`

---

## 3. 知识图谱 (codebase-memory-mcp) 检索与架构定位
- 调用 `codebase-memory-mcp` 对工作区建立最新索引与检索：
  - **Signed Core Client 通信机制**：`plugins/chassis/src/core-client.ts` 通过 HMAC-SHA256 对请求方法、路径、时间戳进行加签，Core API 通过中间件提取并比对密钥校验。
  - **Portal Identity 防伪体系**：`plugins/chassis/src/portal-identity.ts` 提供 60s TTL 的 `x-qm-portal-identity`，生产模式下所有用户级和管理级 API 强制校验此身份，防止伪造身份请求。
  - **Slack 运行时拓扑**：`src/slack/runtime.ts` 结合 SocketMode / HTTP Webhook，将外部事件映射为 Core Turn 轮次，并通过 `delivery.ts`、`approval-cards.ts`、`reactions.ts` 实现多端持久化可靠投递。

---

## 4. 重点问题排查与平台适配
1. **Windows CRLF 换行符归一化**：
   - 从基线检出的测试文件由于 Windows Git 检出导致 CRLF 换行，导致测试中正则多行匹配失败（如 `settings-load.test.ts`、`css-vars.test.ts`）。全仓清洗归一为 LF。
2. **Esbuild 绝对路径 Windows 兼容性**：
   - `plugins/admin/test/*.test.ts` 中使用 `new URL(..., import.meta.url).pathname` 在 Windows 下生成 `/C:/...` 形式路径导致 esbuild 报错。全部改用 Node 原生 `fileURLToPath(new URL(...))` 彻底解决。
3. **Portal 反向代理 HTTPS 上游支持**：
   - `plugins/portal/src/proxy.ts` 在转发外部上游时，根据协议动态选择 `node:http.request` 或 `node:https.request`，防止 HTTPS 报错 `ERR_INVALID_PROTOCOL`。
4. **CLI 镜像清单恢复**：
   - 补齐 `cli/manifest.json`，确保 Docker、Fly、AWS 部署时正确解析镜像 Digest。
5. **Windows 沙箱冷启动轮询超时调整**：
   - `test/surface-spine-routing.test.ts` 与 `test/web-ui-sse.test.ts` 在 Windows 平台上因沙箱进程冷启动开销较大（~39s），将等待超时 deadline 相应调优（由 30s 提高至 90s），确保在各类系统负载下稳定 100% 通过。

---

## 5. 全量构建、类型检查与测试验证
### 1) TypeScript 类型检查 (0 错误)
- 根工程：`npm run typecheck` **0 TS 错误 (PASSED)**
- `plugins/admin`: `npm run typecheck` **0 TS 错误 (PASSED)**
- `plugins/portal`: `npm run typecheck` **0 TS 错误 (PASSED)**
- `plugins/web-ui`: `npm run typecheck` **0 TS 错误 (PASSED)**
- `plugins/auth`: `npm run typecheck` **0 TS 错误 (PASSED)**

### 2) 前端构建打包
- `plugins/web-ui`: `npm run build`
  - Vite 生产打包顺利生成，35 个静态资源全部经 gzip 预压缩，生成 `.gz` 文件。

### 3) 各插件与核心测试套件 (100% 满分通过)
- **`plugins/admin` 独立测试套件**：**227 / 227 PASSED (100%)**
- **`plugins/portal` 独立测试套件**：**156 / 156 PASSED (100%)**
- **`plugins/web-ui` 独立测试套件**：**1389 / 1389 PASSED (100%)**
- **Portal 核心测试套件 (`test/portal-*.test.ts`)**：**29 / 29 PASSED (100%)**
- **Web UI 路由测试套件 (`test/web-ui-*.test.ts`)**：**27 / 27 PASSED (100%)**
- **Surface 综合测试套件 (`test/surface-*.test.ts`)**：**138 / 138 PASSED (100%)**
- **Admin 管理测试套件 (`test/admin-*.test.ts`, `trusted-admin`, `mcp-admin`)**：**192 / 192 PASSED (100%)**
- **Slack 契约与运行时测试套件 (`test/*slack*.test.ts`)**：**718 / 718 PASSED (2 skipped, 100%)**

---

## 6. 代码规范合规确认
- **Zero Comments**：严格遵循规范，`src/` 内部 0 行解释性注释/JSDoc/TODO。
- **Zero AI Attribution**：严禁并剔除任何 `Co-authored-by` 或 AI 生成标识。
- **Durable by Default**：Slack 镜像、安装授权、会话上下文与审批均由 Postgres 数据库保证持久化恢复。
- **大表顺序续写**：已在根目录 `QM_FUNCTION_CODE_MAP.md` 末尾按照标准格式追加 G6 的全量功能与文件映射。
