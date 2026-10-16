import { getOrCreateWorkflowSandbox, releaseWorkflowSandbox, WorkflowSandboxDeps } from './lifecycle'

const memoryDeps = (overrides: Partial<WorkflowSandboxDeps> = {}): WorkflowSandboxDeps & { rows: Map<string, any> } => {
    const rows = new Map<string, any>()
    const driver = {
        create: jest.fn(async () => ({ sandboxId: `sbx-${rows.size + 1}`, sandbox: { id: rows.size + 1, kill: jest.fn() } })),
        connect: jest.fn(async (sandboxId: string) => ({ sandboxId, kill: jest.fn() })),
        kill: jest.fn(async () => undefined),
        extend: jest.fn(async () => undefined)
    }
    return {
        rows,
        driver,
        store: {
            findByChatflowId: async (chatflowId: string) => rows.get(chatflowId) || null,
            save: async (record) => {
                rows.set(record.chatflowId, record)
            },
            deleteByChatflowId: async (chatflowId: string) => {
                rows.delete(chatflowId)
            }
        },
        config: { apiKey: 'k', apiUrl: 'https://acs.example.com', template: 'code', timeoutMs: 1000 },
        live: new Map(),
        locks: new Map(),
        ...overrides
    }
}

describe('per-workflow sandbox lifecycle', () => {
    it('creates a sandbox on the first run and reuses it without killing', async () => {
        const deps = memoryDeps()
        const first = await getOrCreateWorkflowSandbox('flow-1', deps)
        const second = await getOrCreateWorkflowSandbox('flow-1', deps)

        expect(first.sandboxId).toBe(second.sandboxId)
        expect(deps.driver.create).toHaveBeenCalledTimes(1)
        expect(deps.driver.kill).not.toHaveBeenCalled()
        expect(deps.rows.get('flow-1').sandboxId).toBe(first.sandboxId)
    })

    it('replaces a sandbox that can no longer be connected', async () => {
        const deps = memoryDeps()
        await getOrCreateWorkflowSandbox('flow-1', deps)
        deps.live.clear()
        ;(deps.driver.connect as jest.Mock).mockRejectedValueOnce(new Error('gone'))

        const replaced = await getOrCreateWorkflowSandbox('flow-1', deps)
        expect(deps.driver.create).toHaveBeenCalledTimes(2)
        expect(replaced.sandboxId).toBe('sbx-2')
        expect(deps.driver.kill).not.toHaveBeenCalled()
    })

    it('kills the sandbox only when it is explicitly released', async () => {
        const deps = memoryDeps()
        const created = await getOrCreateWorkflowSandbox('flow-1', deps)
        expect(deps.driver.kill).not.toHaveBeenCalled()

        const released = await releaseWorkflowSandbox('flow-1', deps)
        expect(released.released).toBe(true)
        expect(released.sandboxId).toBe(created.sandboxId)
        expect(deps.driver.kill).toHaveBeenCalledTimes(1)
        expect(deps.rows.has('flow-1')).toBe(false)

        await getOrCreateWorkflowSandbox('flow-1', deps)
        expect(deps.driver.create).toHaveBeenCalledTimes(2)
    })
})
