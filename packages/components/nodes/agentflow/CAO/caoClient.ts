export const CAO_PROVIDERS = [
    { label: 'Claude Code', name: 'claude_code' },
    { label: 'Codex', name: 'codex' },
    { label: 'Cursor CLI', name: 'cursor_cli' },
    { label: 'Q CLI', name: 'q_cli' },
    { label: 'Kiro CLI', name: 'kiro_cli' },
    { label: 'Copilot CLI', name: 'copilot_cli' },
    { label: 'OpenCode CLI', name: 'opencode_cli' },
    { label: 'Kimi CLI', name: 'kimi_cli' },
    { label: 'Hermes', name: 'hermes' },
    { label: 'Antigravity CLI', name: 'antigravity_cli' }
] as const

export const CAO_MODES = ['handoff', 'assign', 'send_message'] as const

export type CaoMode = (typeof CAO_MODES)[number]

export interface CaoIdentity {
    chatflowId: string
    nodeId: string
}

export interface CaoPersistedSession {
    caoSessionName?: string
    terminalId?: string
}

export interface CaoConfig {
    serverUrl: string
    bearerToken?: string
    provider: string
    agentProfile: string
    mode: CaoMode
    task: string
    explicitSessionName?: string
    reuseTerminal: boolean
    teardown: boolean
    timeoutSeconds: number
    wait: boolean
    workingDirectory?: string
    callerId?: string
    receiverId?: string
    allowedTools: string[]
    useWorktree: boolean
    memoryManager: boolean
    envVars?: Record<string, string>
    claimId?: string
    group?: unknown
    metadata?: unknown
    shapePrompt: boolean
    injectSenderId: boolean
    jobId?: string
    pollIntervalSeconds: number
}

export interface CaoHttpRequest {
    method: 'GET' | 'POST'
    url: string
    query?: Record<string, string>
    body?: unknown
    timeoutMs: number
    headers: Record<string, string>
}

export interface CaoHttpResponse {
    status: number
    data: any
}

export type CaoHttp = (request: CaoHttpRequest) => Promise<CaoHttpResponse>

export interface CaoCallRecord {
    method: string
    path: string
    query?: Record<string, string>
    body?: unknown
}

export interface CaoRunResult {
    status: string
    content: string
    sessionName: string
    terminalId?: string
    request: CaoCallRecord[]
    response: unknown
}

const asBoolean = (value: unknown, fallback: boolean): boolean => {
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value === 'boolean') return value
    const text = String(value).toLowerCase()
    if (text === 'true' || text === '1' || text === 'yes') return true
    if (text === 'false' || text === '0' || text === 'no') return false
    return fallback
}

const asText = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim())

const parseJsonObject = (value: unknown, label: string): Record<string, string> | undefined => {
    const text = asText(value)
    if (!text) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new Error(`${label} must be JSON`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`)
    const record: Record<string, string> = {}
    for (const [key, item] of Object.entries(parsed as Record<string, unknown>)) {
        record[key] = item === undefined || item === null ? '' : String(item)
    }
    return record
}

const parseJsonValue = (value: unknown, label: string): unknown => {
    const text = asText(value)
    if (!text) return undefined
    try {
        return JSON.parse(text)
    } catch {
        throw new Error(`${label} must be JSON`)
    }
}

export const assertCaoUrl = (value: string): string => {
    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        throw new Error('CAO server URL must be an http(s) URL')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('CAO server URL must be an http(s) URL')
    }
    return value.replace(/\/+$/, '')
}

export const sessionNameForFlow = (identity: CaoIdentity): string => {
    const raw = `${identity.chatflowId}:${identity.nodeId}`
    let hash = 0
    for (let i = 0; i < raw.length; i += 1) {
        hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0
    }
    const hex = (hash >>> 0).toString(16)
    const node = identity.nodeId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
    return `flow${hex}${node}`.slice(0, 32)
}

export const sanitizeSessionName = (value: string): string => {
    const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
    if (!cleaned) throw new Error('CAO session name must contain letters or numbers')
    return cleaned
}

export const normalizeCaoConfig = (
    inputs: Record<string, unknown> | undefined,
    env: NodeJS.ProcessEnv = process.env,
    credential: Record<string, unknown> = {}
): CaoConfig => {
    const source = inputs || {}
    const serverUrl = assertCaoUrl(
        asText(source.caoServerUrl) || asText(credential.serverUrl) || asText(env.CAO_SERVER_URL) || asText(credential.caoServerUrl)
    )
    const provider = asText(source.caoProvider) || 'claude_code'
    if (!CAO_PROVIDERS.some((item) => item.name === provider)) {
        throw new Error(`Unsupported CAO provider: ${provider}`)
    }
    const modeText = asText(source.caoMode) || 'handoff'
    if (!CAO_MODES.includes(modeText as CaoMode)) throw new Error(`Unsupported CAO mode: ${modeText}`)
    const mode = modeText as CaoMode
    const task = asText(source.caoTask)
    if (!task) throw new Error('CAO node requires a task')
    const behavior = asText(source.caoWaitBehavior) || 'default'
    const wait = behavior === 'wait' ? true : behavior === 'return' ? false : mode === 'handoff'
    const timeoutSeconds = Number(source.caoTimeoutSeconds || env.CAO_TIMEOUT_SECONDS || 600)
    const pollIntervalSeconds = Number(source.caoPollIntervalSeconds || 2)
    const claimId = asText(source.caoClaimId)
    if (claimId && !/^[a-f0-9]{32}$/.test(claimId)) throw new Error('CAO claim id must be 32 lowercase hex characters')
    const jobId = asText(source.caoJobId)
    if (jobId && !/^[a-f0-9]{32}$/.test(jobId)) throw new Error('CAO job id must be 32 lowercase hex characters')
    const allowedTools = asText(source.caoAllowedTools)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    return {
        serverUrl,
        bearerToken: asText(source.caoBearerToken) || asText(credential.bearerToken) || asText(env.CAO_BEARER_TOKEN) || undefined,
        provider,
        agentProfile: asText(source.caoAgentProfile) || asText(env.CAO_AGENT_PROFILE) || 'developer',
        mode,
        task,
        explicitSessionName: asText(source.caoSessionName) || undefined,
        reuseTerminal: asBoolean(source.caoReuseTerminal, true),
        teardown: asBoolean(source.caoTeardown, false),
        timeoutSeconds: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : 600,
        wait,
        workingDirectory: asText(source.caoWorkingDirectory) || undefined,
        callerId: asText(source.caoCallerId) || undefined,
        receiverId: asText(source.caoReceiverId) || undefined,
        allowedTools,
        useWorktree: asBoolean(source.caoUseWorktree, false),
        memoryManager: asBoolean(source.caoMemoryManager, false),
        envVars: parseJsonObject(source.caoEnvVars, 'Env vars'),
        claimId: claimId || undefined,
        group: parseJsonValue(source.caoGroup, 'Group'),
        metadata: parseJsonValue(source.caoMetadata, 'Metadata'),
        shapePrompt: asBoolean(source.caoShapePrompt, true),
        injectSenderId: asBoolean(source.caoInjectSenderId, false),
        jobId: jobId || undefined,
        pollIntervalSeconds: Number.isFinite(pollIntervalSeconds) && pollIntervalSeconds > 0 ? pollIntervalSeconds : 2
    }
}

export const resolveSessionName = (config: CaoConfig, persisted: CaoPersistedSession | undefined, identity: CaoIdentity): string => {
    if (config.explicitSessionName) return sanitizeSessionName(config.explicitSessionName)
    if (persisted?.caoSessionName) return persisted.caoSessionName
    return sessionNameForFlow(identity)
}

export const buildCaoPrompt = (config: CaoConfig, terminalId?: string): string => {
    let text = config.task
    if (config.shapePrompt && config.provider === 'codex') {
        text = `CAO_TERMINAL_ID=${terminalId || 'pending'}\n${text}`
    }
    if (config.injectSenderId && config.callerId) {
        text = `${text}\n\n(sender: ${config.callerId})`
    }
    return text
}

const joinUrl = (base: string, path: string): string => `${base}${path}`

const authHeaders = (config: CaoConfig): Record<string, string> => {
    const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' }
    if (config.bearerToken) headers.authorization = `Bearer ${config.bearerToken}`
    return headers
}

const queryFrom = (pairs: Record<string, string | undefined>): Record<string, string> | undefined => {
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries(pairs)) {
        if (value) query[key] = value
    }
    return Object.keys(query).length ? query : undefined
}

const detailMessage = (data: any, fallback: string): string => {
    if (!data) return fallback
    if (typeof data.detail === 'string') return data.detail
    if (data.detail?.message) return String(data.detail.message)
    if (data.message) return String(data.message)
    return fallback
}

const terminalIdOf = (data: any): string | undefined => data?.terminal_id || data?.terminalId || data?.id

export const executeCao = async (
    config: CaoConfig,
    persisted: CaoPersistedSession | undefined,
    identity: CaoIdentity,
    http: CaoHttp,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<CaoRunResult> => {
    const sessionName = resolveSessionName(config, persisted, identity)
    const calls: CaoCallRecord[] = []
    const timeoutMs = (config.timeoutSeconds + 30) * 1000
    const call = async (method: 'GET' | 'POST', path: string, query?: Record<string, string>, body?: unknown) => {
        const recordedBody = body && typeof body === 'object' && !Array.isArray(body) ? { ...(body as Record<string, unknown>) } : body
        if (recordedBody && typeof recordedBody === 'object' && !Array.isArray(recordedBody) && 'env_vars' in recordedBody) {
            ;(recordedBody as Record<string, unknown>).env_vars = '[redacted]'
        }
        calls.push({ method, path, query, body: recordedBody })
        const response = await http({
            method,
            url: joinUrl(config.serverUrl, path),
            query,
            body,
            timeoutMs,
            headers: authHeaders(config)
        })
        return response
    }

    const createSession = async () => {
        const query = queryFrom({
            agent_profile: config.agentProfile,
            provider: config.provider,
            session_name: sessionName,
            working_directory: config.workingDirectory,
            allowed_tools: config.allowedTools.length ? config.allowedTools.join(',') : undefined,
            memory_manager: config.memoryManager ? 'true' : undefined
        })
        const body: Record<string, unknown> = {}
        if (config.envVars) body.env_vars = config.envVars
        if (config.group !== undefined) body.group = config.group
        if (config.metadata !== undefined) body.metadata = config.metadata
        const response = await call('POST', '/sessions', query, Object.keys(body).length ? body : undefined)
        if (response.status !== 201 && response.status !== 409 && response.status !== 200) {
            throw new Error(`CAO session create failed: ${detailMessage(response.data, `HTTP ${response.status}`)}`)
        }
        return response
    }

    const createTerminal = async () => {
        const query = queryFrom({
            provider: config.provider,
            agent_profile: config.agentProfile,
            working_directory: config.workingDirectory,
            allowed_tools: config.allowedTools.length ? config.allowedTools.join(',') : undefined,
            caller_id: config.callerId,
            claim_id: config.reuseTerminal && persisted?.terminalId ? undefined : config.claimId,
            use_worktree: config.useWorktree ? 'true' : undefined
        })
        const response = await call('POST', `/sessions/${encodeURIComponent(sessionName)}/terminals`, query)
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`CAO terminal create failed: ${detailMessage(response.data, `HTTP ${response.status}`)}`)
        }
        const terminalId = terminalIdOf(response.data)
        if (!terminalId) throw new Error('CAO terminal create did not return a terminal id')
        return terminalId
    }

    const sendInput = async (terminalId: string, prompt: string) => {
        const body = { message: prompt }
        const response = await call('POST', `/terminals/${encodeURIComponent(terminalId)}/input`, undefined, body)
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`CAO input failed: ${detailMessage(response.data, `HTTP ${response.status}`)}`)
        }
        return response
    }

    const poll = async (terminalId: string) => {
        const deadline = Date.now() + config.timeoutSeconds * 1000
        let last: any = {}
        let status = 'running'
        while (Date.now() <= deadline) {
            const response = await call('GET', `/terminals/${encodeURIComponent(terminalId)}`)
            last = response.data
            status = String(last?.status || '').toLowerCase()
            if (status === 'completed' || status === 'error') break
            await sleep(config.pollIntervalSeconds * 1000)
            if (Date.now() > deadline) {
                status = 'timeout'
                break
            }
        }
        if (status !== 'completed' && status !== 'error') status = 'timeout'
        const output = await call('GET', `/terminals/${encodeURIComponent(terminalId)}/output`, { mode: 'full' })
        const content = String(output.data?.output || last?.last_message || last?.output || '')
        return { status, content, response: { terminal: last, output: output.data } }
    }

    if (config.mode === 'handoff' && config.wait) {
        await createSession()
        const reuse = config.reuseTerminal && persisted?.terminalId && !config.claimId ? persisted.terminalId : undefined
        const prompt = buildCaoPrompt(config, reuse)
        const body: Record<string, unknown> = {
            provider: config.provider,
            agent: config.agentProfile,
            prompt,
            session_name: sessionName,
            teardown: config.teardown,
            timeout: config.timeoutSeconds
        }
        if (reuse) body.reuse_terminal_id = reuse
        if (config.workingDirectory) body.working_directory = config.workingDirectory
        if (config.callerId) body.caller_id = config.callerId
        if (config.allowedTools.length) body.allowed_tools = config.allowedTools
        if (config.jobId) body.job_id = config.jobId
        if (config.useWorktree) body.use_worktree = true
        if (config.claimId && !reuse) body.claim_id = config.claimId
        let response = await call('POST', '/terminals/run-step', undefined, body)
        if (response.status === 404 && reuse) {
            delete body.reuse_terminal_id
            response = await call('POST', '/terminals/run-step', undefined, body)
        }
        if (response.status < 200 || response.status >= 300) {
            const kind = response.data?.detail?.kind
            const message = detailMessage(response.data, `HTTP ${response.status}`)
            const error = new Error(kind === 'timeout' ? `CAO handoff timed out: ${message}` : `CAO handoff failed: ${message}`)
            ;(error as any).cao = {
                request: calls,
                response: response.data,
                sessionName,
                terminalId: response.data?.detail?.terminal_id || reuse
            }
            throw error
        }
        return {
            status: String(response.data?.status || 'completed'),
            content: String(response.data?.last_message || ''),
            sessionName,
            terminalId: response.data?.terminal_id || reuse,
            request: calls,
            response: response.data
        }
    }

    await createSession()
    let terminalId = config.reuseTerminal ? persisted?.terminalId : undefined
    if (config.mode === 'send_message') {
        terminalId = config.receiverId || terminalId
    }
    if (!terminalId) terminalId = await createTerminal()
    const prompt = buildCaoPrompt(config, terminalId)

    if (config.mode === 'send_message') {
        const senderId = config.callerId || 'flowise'
        const response = await call('POST', `/terminals/${encodeURIComponent(terminalId)}/inbox/messages`, undefined, {
            sender_id: senderId,
            message: prompt
        })
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`CAO send_message failed: ${detailMessage(response.data, `HTTP ${response.status}`)}`)
        }
        if (!config.wait) {
            return { status: 'accepted', content: '', sessionName, terminalId, request: calls, response: response.data }
        }
        const waited = await poll(terminalId)
        return { status: waited.status, content: waited.content, sessionName, terminalId, request: calls, response: waited.response }
    }

    const inputResponse = await sendInput(terminalId, prompt)
    if (!config.wait) {
        return { status: 'accepted', content: '', sessionName, terminalId, request: calls, response: inputResponse.data }
    }
    const waited = await poll(terminalId)
    return { status: waited.status, content: waited.content, sessionName, terminalId, request: calls, response: waited.response }
}
