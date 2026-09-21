# QM 核心运行时调用链与时序追踪 (G1 交付物)

> **所属门控**：`G1` (拆解与装配地图)  
> **分析工具**：`codebase-memory-mcp:trace_path` / `query_graph`

---

## 1. 核心链路 1：HTTP 请求准入与会话租约分配

当客户端发起 `/api/turns` 或进入会话时，系统执行严格的身份鉴定、租户作用域解析与租约抢占：

```mermaid
sequenceDiagram
    autonumber
    participant Client as 客户端 (Web UI / Slack)
    participant Router as HTTP Router (src/api/routes)
    participant Auth as 鉴权中间件 (src/auth)
    participant Scope as 作用域解析 (src/resolution)
    participant Lease as 租约管理器 (src/sessions)
    participant PG as Postgres 存储池 (src/persistence)

    Client->>Router: POST /api/turns (Bearer Token / Cookie)
    Router->>Auth: authenticateRequest(headers)
    Auth->>PG: verifySession / readPrincipal()
    PG-->>Auth: PrincipalAssertion (Tenant, Actor, Permissions)
    Auth-->>Router: Authorized Context
    
    Router->>Scope: resolveScope(principal, requestedScopeId)
    Scope->>PG: queryAclGrants(scopeId, actor)
    PG-->>Scope: AclRules (Read, Write, Execute)
    Scope-->>Router: Validated ScopeContext
    
    Router->>Lease: acquireSessionLease(conversationId, actorId)
    Lease->>PG: SELECT FOR UPDATE / INSERT lease_record
    PG-->>Lease: Lease Granted (TTL 30s)
    Lease-->>Router: Active Lease Lock
```

---

## 2. 核心链路 2：Agent 核心执行与模型推理流 (Turn Loop)

核心执行调度器控制大模型多轮思考与工具调用分支：

```mermaid
sequenceDiagram
    autonumber
    participant App as 核心装配层 (src/wiring)
    participant Loop as Turn Loop (src/loops)
    participant Context as 上下文构建 (src/memory / skills)
    participant Harness as 模型 Harness (src/harness/pi)
    participant GLM as 大模型 API (Zhipu GLM-4 / Claude)
    participant Stream as SSE 流式推送 (src/api/sse)

    App->>Loop: dispatchTurn(turnPayload, scopeContext)
    Loop->>Context: assemblePromptContext(conversationId)
    Context-->>Loop: SystemPrompt + History + Skills + MemoryNotebook
    
    Loop->>Harness: runInference(assembledMessages, toolSpecs)
    Harness->>GLM: POST /chat/completions (Stream: true)
    
    loop 流式 Token 接收
        GLM-->>Harness: delta chunk
        Harness->>Stream: emitToken(chunk)
        Stream-->>Client: data: chunk
    end
    
    alt 模型发起工具调用 (Tool Call)
        GLM-->>Harness: tool_call (name, args)
        Harness-->>Loop: ToolCallRequest
        Loop->>Tools: dispatchToolExecution()
    else 模型完成回答
        GLM-->>Harness: stop_reason: "end_turn"
        Harness-->>Loop: TurnCompleted
    end
```

---

## 3. 核心链路 3：本地 Docker 隔离沙箱工具执行

针对敏感命令与代码运行，通过本地 Docker 容器进行双轨隔离：

```mermaid
sequenceDiagram
    autonumber
    participant Tools as 工具分发器 (src/tools)
    participant SandboxMgr as 沙箱管理器 (src/sandbox)
    participant Docker as 本地 Docker 守护进程 (wsllocal)
    participant Container as 隔离容器 (qm-sandbox-local)
    participant Volume as 持久化卷 (notes/workspace)

    Tools->>SandboxMgr: executeCommand(cmd, scopeId, timeoutMs)
    SandboxMgr->>SandboxMgr: checkWarmContainer(scopeId)
    
    alt 容器未运行 (Cold Start)
        SandboxMgr->>Docker: docker run -d --network=none -v scope_vol:/workspace qm-sandbox-local
        Docker-->>SandboxMgr: Container ID (ColdStart: true)
    else 容器已就绪 (Warm Reuse)
        SandboxMgr-->>Docker: Inspect container status
    end
    
    SandboxMgr->>Docker: docker exec <id> /bin/bash -c "cmd"
    Docker->>Container: 执行进程
    Container->>Volume: 读写工作区文件
    Container-->>Docker: stdout / stderr / exit_code
    Docker-->>SandboxMgr: Process Result
    SandboxMgr-->>Tools: Structured Output (exitCode, stdout, durationMs)
```

---

## 4. 核心链路 4：状态回写、审计日志与流式交付

每轮执行完毕后，执行副作用原子落盘并广播更新：

```mermaid
sequenceDiagram
    autonumber
    participant Loop as Turn Loop (src/loops)
    participant Audit as 审计与监控 (src/admin)
    participant Memory as 记忆提取 (src/memory)
    participant PG as Postgres 数据库
    participant Delivery as 外部投递 (src/delivery)

    Loop->>PG: INSERT INTO turns (turn_id, messages, status)
    Loop->>PG: INSERT INTO session_messages (...)
    Loop->>Audit: recordAuditEvent(actor, toolCalls, duration)
    Audit->>PG: INSERT INTO audit_events (...)
    
    Loop->>Memory: extractTurnMemories(turnContext)
    Memory->>PG: INSERT INTO memory_revisions (...)
    
    Loop->>Delivery: notifySubscribers(conversationId)
    Delivery->>Client: SSE Event: 'turn.completed'
```
