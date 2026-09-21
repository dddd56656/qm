# G1 阶段总结与后续执行指引 (G1_SUMMARY.md)

> **当前阶段状态**：`G1` (拆解与装配地图) **已验收通过 (PASS)**  
> **分支与标签**：分支 `gate/g01-disassembly`，通过标签 `gate/g01-pass`  
> **前置基线**：已通过 `git merge gate/g00-baseline` 完整接入 G0 基线与运行标本  
> **核心工具支撑**：`codebase-memory-mcp` (知识图谱包含 28,272 节点, 146,761 关系边)

---

## 1. G1 核心工作与交付物归纳

本阶段依据 `plan.md` G1 目标，采用结构化知识图谱与静态/类型依赖分析，将全量 2,214 个上游基线文件彻底解构为清晰可循的拼图骨架。

所有核心交付物已沉淀为根目录专业规范 Markdown 文档，任何后续 Agent 一眼即可纵览全局：

| 交付物文档 | 核心内容与价值 | 关键指标 / 结论 |
| :--- | :--- | :--- |
| **`G1_ARCHITECTURE.md`** | 6 逻辑层次架构拓扑图、Mermaid 模块装配流向、图谱热点与系统职责分工。 | 详述 Layer 2 ~ Layer 7 架构；锁定 `src/wiring.ts` 为唯一合法装配总线。 |
| **`G1_CALL_CHAINS.md`** | 核心运行时调用链追踪（HTTP 准入、Turn Loop 调度、Docker 本地沙箱隔离、状态持久）。 | 4 幅 Mermaid 时序图，精准还原上下文在模块间的流转顺序。 |
| **`G1_DEPENDENCY_GRAPH.md`** | 模块依赖图谱、5 类导入类型精细化标注、Tarjan 强连通分量 (SCC) 环分析。 | 区分 9,268 运行时导入与 1,782 类型导入；证明**全仓无跨 Gate 运行时环**。 |
| **`G1_RESTORE_MANIFEST.md`** | 逐文件门控分配清单与精确 Git 复原指令。 | 全仓 2,214 文件按 G2~G7 严格划分，双向互补，每个文件均有唯一归宿。 |
| **`G1_VERIFICATION_MATRIX.md`**| G0 ~ G12 全流程 13 个 Quality Gate 的准入、准出、验收命令与证据标准。 | 标准化质量卡点，杜绝虚假 Mock，支撑多 Agent 并行冲刺。 |
| **`g1_detailed_analysis.json`**| 机器可读的结构化依赖数据。 | 供后续 CI/CD 与自动化脚本校验文件完整性。 |

---

## 2. 核心架构发现与并行拓扑论证

依托 `codebase-memory-mcp` 与精确依赖解析，G1 取得了重大架构突破与执行论证：

1. **G3 (隔离执行) 与 G4 (后台服务) 的绝对解耦**：
   - 依赖分析表明，`src/harness/`, `src/sandbox/`, `src/tools/` 与 `src/memory/`, `src/skills/`, `src/cron/` 之间**零运行时依赖边**。
   - **这意味着 G2 状态底座就绪后，G3 与 G4 两个工作区可以完全双轨并行开发，无冲突风险**。
2. **零跨门控运行时循环**：
   - 通过将 `import type` 与普通 `import` 分离，原有交叉引用完全消除，运行时环依赖仅局限在 Web-UI 前端等单门控内部，保证了自底向上装配的拓扑可行性。
3. **单向装配与零临时代码**：
   - 彻底废除任何临时 mini runtime 的伪造方案，后续阶段严格按原上游代码路径与依赖闭包逐门恢复。

---

## 3. 给后续 Agent (尤其是 G2 开发者) 的执行指引

下一阶段为 **G2 (身份、作用域与状态底座)**。接棒的 Agent 请严格执行以下标准步骤：

### 3.1 启动准备
1. 切换至 `gate/g02-foundation` 工作区分支。
2. 执行 `git merge --ff-only gate/g01-pass` 接入当前 G1 成果。

### 3.2 恢复范围与指令 (详见 `G1_RESTORE_MANIFEST.md`)
G2 需恢复 **254 个文件**，核心包括：
```bash
# 1. 核心模型与配置
git checkout gate/g00-pass -- src/types.ts src/config.ts src/feature-flags.ts src/migrate-main.ts
# 2. 身份、权限与存储
git checkout gate/g00-pass -- src/acl/ src/admin/ src/audit/ src/auth/ src/directory/
git checkout gate/g00-pass -- src/identity/ src/policy/ src/security/ src/resolution/
git checkout gate/g00-pass -- src/persistence/ src/sessions/ src/runs/ src/workspace/
git checkout gate/g00-pass -- src/files/ src/idempotency/ src/environments/ src/deployment/ src/util/
# 3. 对应单元测试
git checkout gate/g00-pass -- test/*acl* test/*auth* test/*directory* test/*identity* test/*persistence* test/*session* test/*run* test/*file* test/*util*
```

### 3.3 验收目标
1. 启动已在运行的 Postgres (`127.0.0.1:55432` 容器 `qm-dev-postgres`)，运行 `npm run migrate`。
2. 跑通基础底座测试：`npm test -- test/*persistence* test/*session* test/*acl*`。
3. 在 `plan.md` 记录 G2 验收证据，并创建不可移动标签 `gate/g02-pass`。
