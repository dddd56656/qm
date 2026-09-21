# codebase-memory-mcp 安装与配置记录

本阶段完成了 `codebase-memory-mcp` (Codebase Knowledge Graph MCP) 在当前 Windows 环境下的安装、权限修复、运行参数调优及配置接入。

---

## 1. 背景与现状诊断

在接入 `codebase-memory-mcp` 时，初始状态与遇到的主要问题如下：

1. **二进制与模式**：
   - 可执行文件已就绪于 `C:\Users\root\.local\bin\codebase-memory-mcp.exe`（版本 `0.10.8`）。
   - 全局配置 `C:\Users\root\.gemini\config\mcp_config.json` 预先登记了该服务器，但无法正常拉起或加载工具。

2. **DACL 权限校验失败（安全防护机制）**：
   - `codebase-memory-mcp` 在 Windows 下具备严格的目录 DACL 安全审查：
     - **Cache 检查**：审查 `C:\Users\root\.cache` 是否存在非特权/外部账户写权限。由于容器/沙箱历史遗留，该目录包含孤立的无名 SID（`S-1-5-21-3541919414-...`）与 `CodexSandboxUsers`，触发 `exact executable identity could not be verified (cache-private)` 错误并主动退出。
     - **Endpoint 检查**：审查协调管道与套接字目录（默认指向 `AppData`），由于 `C:\Users\root\AppData` 同样包含沙箱用户修改权限，触发 `secure daemon endpoint / CLI coordination could not be created` 拦截。

3. **内存预加载性能问题**：
   - 默认配置下，服务根据机器物理内存（~80GB）按比例预分配约 40GB 内存池，导致进程初始化预加载耗时过长。

---

## 2. 操作与修复步骤

### 2.1 修复 `.cache` 目录 DACL 权限

1. 对 `C:\Users\root\.cache` 进行结构与权限重整，移除孤立 SID 及不受信任的沙箱权限规则。
2. 继承 `C:\Users\root` 的标准安全主体：
   - `NT AUTHORITY\SYSTEM`: FullControl
   - `BUILTIN\Administrators`: FullControl
   - `DESKTOP-LCQB086\root`: FullControl
3. 迁移并保留原有数据与数据库索引文件至干净权限的缓存目录中。

### 2.2 隔离 Runtime 目录与配置内存上限

为了避免 `AppData` 的权限污染影响守护进程通信，并通过限制内存池显著提升启动响应速度：

1. **持久化用户环境变量**：
   - `CBM_RUNTIME_DIR = C:\Users\root\.cache\codebase-memory-mcp\run`：将命名管道与运行锁统一收敛至安全目录。
   - `CBM_MEM_BUDGET_MB = 2048`：将工作内存预算限制为 2GB，初始化耗时从数十秒降低至百毫秒内。
2. **关闭冗余 UI 进程**：
   - 执行 `codebase-memory-mcp config set ui_enabled false`，禁用内置 HTTP 图谱服务（原 9749 端口），专注于提供 MCP Stdio 工具服务。

### 2.3 配置 Antigravity 全局 MCP

更新全局配置文件 `C:\Users\root\.gemini\config\mcp_config.json`，为服务注入显式运行环境：

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "C:\\Users\\root\\.local\\bin\\codebase-memory-mcp.exe",
      "args": [],
      "env": {
        "CBM_RUNTIME_DIR": "C:/Users/root/.cache/codebase-memory-mcp/run",
        "CBM_MEM_BUDGET_MB": "2048"
      }
    },
    "blender-mcp": {
      "command": "uvx",
      "args": [
        "blender-mcp"
      ],
      "env": {
        "BLENDER_HOST": "localhost",
        "BLENDER_PORT": "9876"
      }
    }
  }
}
```

---

## 3. 验证与能力交付

1. **Stdio 协议握手验证**：
   - 通过 JSON-RPC 2.0 发送 `initialize` 请求，服务正常回包，确认协议版本为 `2024-11-05`，服务端版本为 `0.10.8`。
   - 发送 `tools/list` 请求，服务完整返回 15 项核心工具：
     - `index_repository`: 仓库知识图谱索引
     - `search_graph`: 符号与图结构搜索
     - `query_graph`: Cypher 图查询
     - `trace_path`: 调用链与依赖链路追踪
     - `get_code_snippet`: 精确代码片段抓取
     - `get_graph_schema`: 图结构 Schema
     - `get_architecture`: 高层架构汇总
     - `search_code`: 源码全文检索
     - `list_projects`: 列出已索引项目
     - `delete_project`: 删除项目图谱
     - `index_status`: 索引健康度与状态查询
     - `check_index_coverage`: 代码索引覆盖率检查
     - `detect_changes`: 增量变更检测
     - `manage_adr`: 架构决策记录管理
     - `ingest_traces`: 追踪数据导入

2. **使用建议**：
   - 后续在当前分支进行代码阅读与分析时，优先通过 MCP 知识图谱工具（`search_graph`, `trace_path`, `get_code_snippet`）进行高精度定位。
