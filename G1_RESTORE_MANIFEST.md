# QM 逐文件门控分配与复原清单 (G1 交付物)

> **所属门控**：`G1` (拆解与装配地图)  
> **基线提交**：`d3bf8d8` / `gate/g00-pass`  
> **总文件数**：2,214 份（100% 精确覆盖，无任何文件遗漏）

---

## 1. 门控文件分配总览

| 门控阶段 | 阶段代号 | 包含文件数 | 物理体积 | 关键目录及覆盖范围 |
| :--- | :--- | :--- | :--- | :--- |
| **控制文档** | `G1_CONTROL` | 4 | ~35 KB | `plan.md`, `AGENTS.md`, `CLAUDE.md`, `G0_SUMMARY.md` |
| **G2 阶段** | `gate/g02-foundation` | 254 | ~1.4 MB | `src/types.ts`, `src/config.ts`, `src/persistence/`, `src/acl/`, `src/identity/`, `src/sessions/`, `src/files/` 及单测 |
| **G3 阶段** | `gate/g03-execution` | 121 | ~0.9 MB | `src/harness/`, `src/sandbox/`, `src/processes/`, `src/tools/`, `aws/microvm-agent/` 及沙箱单测 |
| **G4 阶段** | `gate/g04-services` | 179 | ~1.2 MB | `src/memory/`, `src/skills/`, `src/cron/`, `src/delivery/`, `src/connectors/`, `src/webhooks/` 及服务单测 |
| **G5 阶段** | `gate/g05-core` | 207 | ~1.8 MB | `src/wiring.ts`, `src/index.ts`, `src/api/`, `src/core/`, `src/loops/`, `src/model/` 及集成单测 |
| **G6 阶段** | `gate/g06-surfaces` | 612 | ~6.5 MB | `plugins/web-ui/`, `plugins/admin/`, `plugins/portal/`, `plugins/chassis/`, `src/slack/` |
| **G7 阶段** | `gate/g07-complete` | 837 | ~18.5 MB | `cli/`, `deploy/`, `aws/`, `fly/`, `porter/`, `scripts/`, `skills-seed/`, `docs/`, `test/e2e/` |
| **总计** | **全仓 1:1 闭包** | **2,214** | **~30.3 MB** | **双向互补校验通过：拆除集 ∪ 恢复集 = 基线全集** |

---

## 2. 各门控详细复原模式与指令

任何下游 Agent 执行对应 Gate 恢复时，直接运行以下标准化 Git 还原指令即可获得纯正字节等价的原版源码：

### G2 状态底座恢复（254 文件）
```bash
# 核心领域模型与配置
git checkout gate/g00-pass -- src/types.ts src/config.ts src/feature-flags.ts src/migrate-main.ts
# 身份、权限与存储底座
git checkout gate/g00-pass -- src/acl/ src/admin/ src/audit/ src/auth/ src/directory/
git checkout gate/g00-pass -- src/identity/ src/policy/ src/security/ src/resolution/
git checkout gate/g00-pass -- src/persistence/ src/sessions/ src/runs/ src/workspace/
git checkout gate/g00-pass -- src/files/ src/idempotency/ src/environments/ src/deployment/ src/util/
# 对应基础测试
git checkout gate/g00-pass -- test/*acl* test/*auth* test/*directory* test/*identity* test/*persistence* test/*session* test/*run* test/*file* test/*util*
```

### G3 隔离执行面恢复（121 文件）
```bash
git checkout gate/g00-pass -- src/harness/ src/sandbox/ src/processes/ src/tools/ src/classify/ src/reach/
git checkout gate/g00-pass -- aws/microvm-agent/ local/
git checkout gate/g00-pass -- test/*sandbox* test/*harness* test/*process* test/*tool* test/*docker*
```

### G4 后台服务面恢复（179 文件）
```bash
git checkout gate/g00-pass -- src/memory/ src/skills/ src/cron/ src/connectors/ src/delivery/
git checkout gate/g00-pass -- src/webhooks/ src/tasks/ src/suggestions/ src/triggers/ src/monitors/
git checkout gate/g00-pass -- src/surface-cache/ src/mcp/ src/playgrounds/ src/ratelimit/ src/swarms/ src/wake/
git checkout gate/g00-pass -- test/*memory* test/*skill* test/*cron* test/*connector* test/*delivery* test/*webhook*
```

### G5 核心总装恢复（207 文件）
```bash
git checkout gate/g00-pass -- src/wiring.ts src/index.ts src/instrument.ts src/egress-authz-main.ts
git checkout gate/g00-pass -- src/api/ src/core/ src/loops/ src/model/ src/surfaces/ src/onboarding/ src/projects/
git checkout gate/g00-pass -- test/*wiring* test/*app* test/*api* test/*loop* test/*turn* test/*orchestrator*
```

### G6 交互 Surfaces 恢复（612 文件）
```bash
git checkout gate/g00-pass -- plugins/
git checkout gate/g00-pass -- src/slack/ test/*slack*
```

### G7 全仓补齐恢复（837 文件）
```bash
git checkout gate/g00-pass -- cli/ deploy/ aws/ fly/ porter/ superserve/ scripts/ skills-seed/ docs/ adrs/
git checkout gate/g00-pass -- .github/ .husky/ .claude/ .codex/
git checkout gate/g00-pass -- test/ tsconfig*.json package*.json
```

---

## 3. 逐文件映射索引文件

为方便后续工具链、CI 与自动化脚本精确查询，结构化 JSON 清单已落盘于：
`./g1_detailed_analysis.json`（包含全部 2,214 个文件的哈希值、模式、依赖引用列表与门控分配）。
