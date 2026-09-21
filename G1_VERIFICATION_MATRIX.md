# QM 质量门控全流程验收矩阵 (G1 交付物)

> **所属门控**：`G1` (拆解与装配地图)  
> **门控总览**：覆盖 G0 ~ G12 全周期 13 个质量卡点

---

## 1. 质量门控验收矩阵 (G0 ~ G12)

| 门控代号 | 门控名称 | 依赖前置 | 关键交付物 | 自动化校验命令 | 准出通过条件 (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **G0** | 原版标本与基线 | 无 | 上游清单、运行证据、`G0_SUMMARY.md` | `node scripts/local-sandbox-smoke.ts`<br>`npm run build:connector-sdk` | • 原版 Docker+Postgres 正常运行；<br>• GLM 模型完成单轮交互；<br>• 沙箱冷热启与持久卷验证通过。 |
| **G1** | **拆解与装配地图** | **G0** | **架构图、调用链、依赖图、恢复/拆除清单、`G1_SUMMARY.md`** | **`python scratch/detailed_analyzer.py`<br>`git verify`** | **• 2,214 源码文件 100% 映射至指定 Gate；<br>• 静态/Type/动态导入完成标注；<br>• 无跨 Gate 运行时环；拆除可从 blob 无损恢复。** |
| **G2** | 状态底座 | G1 | 领域模型、64 项 Migrations、Store 契约测试 | `npm test -- test/*persistence* test/*session* test/*acl*` | • Postgres 65 张表结构建立；<br>• Principal/Scope 权限判定生效；<br>• Session 追加与租约锁定正常。 |
| **G3** | 隔离执行面 ⚡ | G2 | Harness 适配器、Docker 沙箱管理、工具原语 | `npm test -- test/*sandbox* test/*harness*`<br>`node scripts/local-sandbox-smoke.ts` | • 至少一个真实模型连通；<br>• 真实 Docker 容器沙箱执行命令与持久挂载成立；<br>• 双租户进程隔离互不干扰。 |
| **G4** | 后台服务面 ⚡ | G2 | Memory 服务、Skills 加载器、Cron 分布式调度 | `npm test -- test/*memory* test/*skill* test/*cron*` | • 记忆 Notebook 读写与租户隔离生效；<br>• Skill pack 解析与签名校验通过；<br>• Cron 定时任务防重抢占成功。 |
| **G5** | Core HTTP 总装 | G3, G4 | `src/wiring.ts`, 完整 HTTP Router, SSE 打字机 | `npm test -- test/*wiring* test/*api* test/*loop*` | • 正式入口唯一使用 `wiring.ts`；<br>• HTTP 单轮/多轮/工具调用闭环；<br>• 服务端 SSE 流式推送正常。 |
| **G6** | 交互 Surfaces ⚡ | G5 | Web UI, Admin 控制台, Portal 认证, Slack 通道 | `cd plugins/web-ui && npm run build`<br>`cd plugins/admin && npm test` | • Web UI 成功打包输出资源；<br>• Admin 154 项测试全绿；<br>• Slack 本地契约通过。 |
| **G7** | 全仓完整补齐 | G5, G6 | CLI 工具、部署脚本、全量 E2E 测试 | `npm run build`<br>`npm test` | • 全量 2,214 个文件完全归位；<br>• Root 与子项目编译通过；<br>• 生产依赖完整锁定。 |
| **G8** | 1:1 原样复原验收 | G7 | 差异比对报告、等价行为对照 | `git diff gate/g00-pass gate/g08-pass` | • 业务源码与 G0 基线 diff 严格为零；<br>• 确定性功能行为 100% 等价复现。 |
| **G9** | 业务系统接入实验 ⚡ | G8 | API 接入 SDK、自定义工具示例、Demo 脚本 | `node scripts/demo-custom-integration.ts` | • 跑通三类接入：直接调用 QM、为 QM 注入新工具、后台 Webhook。 |
| **G10** | 全端汉化与多语言 ⚡ | G8 | 中英字典、多语言解析器、UI 文案报告 | `npm run test:i18n` | • Web/Admin/Portal 核心流程 100% 呈现标准中文；<br>• 协议字段与数据库保持纯英不被误改。 |
| **G11** | 品牌主题换皮 ⚡ | G8 | Logo 资产、CSS Theme Tokens、对照截图 | 页面样式检查 | • 成功换皮 QM Rebuild 专属主题与 Logo；<br>• 移动端与桌面端样式无破损。 |
| **G12** | 最终交付验收 | G8-G11 | 全套 Docker Compose、使用手册、技术报告 | 干净环境一键拉起启动演练 | • 全新环境依文档一键复现；<br>• G8 原版与 G12 定制版双版本发布。 |
