/** Structural match for the E2B connection config. Kept local so tests do not load flowise-components. */
export interface E2BConnectionConfig {
    apiKey?: string
    apiUrl?: string
    domain?: string
    template?: string
    timeoutMs?: number
    metadata?: Record<string, string>
}

export interface WorkflowSandboxHandle {
    sandboxId: string
    sandbox: any
}

export interface WorkflowSandboxDriver {
    create(config: E2BConnectionConfig): Promise<WorkflowSandboxHandle>
    connect(sandboxId: string, config: E2BConnectionConfig): Promise<any>
    kill(sandbox: any): Promise<void>
    extend(sandbox: any, timeoutMs: number): Promise<void>
}

export interface WorkflowSandboxRecord {
    chatflowId: string
    sandboxId: string
    template?: string
    provider?: string
}

export interface WorkflowSandboxStore {
    findByChatflowId(chatflowId: string): Promise<WorkflowSandboxRecord | null>
    save(record: WorkflowSandboxRecord): Promise<void>
    deleteByChatflowId(chatflowId: string): Promise<void>
}

export interface LiveSandbox {
    sandboxId: string
    sandbox: any
}

export interface WorkflowSandboxDeps {
    driver: WorkflowSandboxDriver
    store: WorkflowSandboxStore
    config: E2BConnectionConfig
    live: Map<string, LiveSandbox>
    locks?: Map<string, Promise<LiveSandbox>>
    warn?: (message: string) => void
}

const warn = (deps: WorkflowSandboxDeps, message: string) => {
    if (deps.warn) deps.warn(message)
}

/**
 * Return the sandbox for a chatflow, creating it on the first call.
 * Completing, failing, or pausing a run must not call release.
 */
export const getOrCreateWorkflowSandbox = async (chatflowId: string, deps: WorkflowSandboxDeps): Promise<LiveSandbox> => {
    const lockMap = deps.locks || new Map<string, Promise<LiveSandbox>>()
    const pending = lockMap.get(chatflowId)
    if (pending) return pending

    const created = doGetOrCreate(chatflowId, deps).finally(() => {
        if (lockMap.get(chatflowId) === created) lockMap.delete(chatflowId)
    })
    lockMap.set(chatflowId, created)
    return created
}

const doGetOrCreate = async (chatflowId: string, deps: WorkflowSandboxDeps): Promise<LiveSandbox> => {
    const cached = deps.live.get(chatflowId)
    if (cached) {
        await keepAlive(cached, deps)
        return cached
    }

    const existing = await deps.store.findByChatflowId(chatflowId)
    if (existing) {
        try {
            const sandbox = await deps.driver.connect(existing.sandboxId, { ...deps.config, metadata: { chatflowId } })
            const live = { sandboxId: existing.sandboxId, sandbox }
            deps.live.set(chatflowId, live)
            await keepAlive(live, deps)
            return live
        } catch (error) {
            warn(deps, `[sandbox] Replacing dead sandbox for chatflow ${chatflowId}: ${(error as Error).message}`)
        }
    }

    const created = await deps.driver.create({ ...deps.config, metadata: { chatflowId } })
    await deps.store.save({
        chatflowId,
        sandboxId: created.sandboxId,
        template: deps.config.template,
        provider: 'e2b'
    })
    const live = { sandboxId: created.sandboxId, sandbox: created.sandbox }
    deps.live.set(chatflowId, live)
    return live
}

const keepAlive = async (live: LiveSandbox, deps: WorkflowSandboxDeps) => {
    if (!deps.config.timeoutMs) return
    try {
        await deps.driver.extend(live.sandbox, deps.config.timeoutMs)
    } catch (error) {
        warn(deps, `[sandbox] Could not extend sandbox ${live.sandboxId}: ${(error as Error).message}`)
    }
}

/** Explicit user action or chatflow deletion. Runs do not call this. */
export const releaseWorkflowSandbox = async (
    chatflowId: string,
    deps: WorkflowSandboxDeps
): Promise<{ released: boolean; sandboxId?: string }> => {
    const row = await deps.store.findByChatflowId(chatflowId)
    const live = deps.live.get(chatflowId)
    deps.live.delete(chatflowId)
    if (!row && !live) return { released: false }

    const sandboxId = live?.sandboxId || row?.sandboxId
    try {
        if (live?.sandbox) {
            await deps.driver.kill(live.sandbox)
        } else if (row) {
            const sandbox = await deps.driver.connect(row.sandboxId, deps.config)
            await deps.driver.kill(sandbox)
        }
    } catch (error) {
        warn(deps, `[sandbox] Kill failed for chatflow ${chatflowId}: ${(error as Error).message}`)
    }
    await deps.store.deleteByChatflowId(chatflowId)
    return { released: true, sandboxId }
}
