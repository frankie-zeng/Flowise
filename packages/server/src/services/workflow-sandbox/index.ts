import { WorkflowSandbox } from '../../database/entities/WorkflowSandbox'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'
import {
    getOrCreateWorkflowSandbox,
    LiveSandbox,
    releaseWorkflowSandbox,
    WorkflowSandboxDeps,
    WorkflowSandboxDriver,
    WorkflowSandboxStore
} from './lifecycle'

export {
    getOrCreateWorkflowSandbox,
    releaseWorkflowSandbox,
    WorkflowSandboxDeps,
    WorkflowSandboxDriver,
    WorkflowSandboxStore,
    LiveSandbox
} from './lifecycle'

const liveSandboxes = new Map<string, LiveSandbox>()
const locks = new Map<string, Promise<LiveSandbox>>()

const typeormStore = (): WorkflowSandboxStore => ({
    async findByChatflowId(chatflowId: string) {
        const repo = getRunningExpressApp().AppDataSource.getRepository(WorkflowSandbox)
        const row = await repo.findOne({ where: { chatflowId } })
        if (!row) return null
        return { chatflowId: row.chatflowId, sandboxId: row.sandboxId, template: row.template, provider: row.provider }
    },
    async save(record) {
        const repo = getRunningExpressApp().AppDataSource.getRepository(WorkflowSandbox)
        const existing = await repo.findOne({ where: { chatflowId: record.chatflowId } })
        if (existing) {
            existing.sandboxId = record.sandboxId
            existing.template = record.template
            existing.provider = record.provider || 'e2b'
            await repo.save(existing)
            return
        }
        await repo.save(repo.create({ ...record, provider: record.provider || 'e2b' }))
    },
    async deleteByChatflowId(chatflowId: string) {
        await getRunningExpressApp().AppDataSource.getRepository(WorkflowSandbox).delete({ chatflowId })
    }
})

const defaultDriver = async (): Promise<WorkflowSandboxDriver> => {
    const components = await import('flowise-components')
    return {
        create: (config) => components.createE2BSandbox(config),
        connect: (sandboxId, config) => components.connectE2BSandbox(sandboxId, config),
        kill: (sandbox) => components.killE2BSandbox(sandbox),
        extend: (sandbox, timeoutMs) => components.extendE2BSandbox(sandbox, timeoutMs)
    }
}

export const defaultWorkflowSandboxDeps = async (): Promise<WorkflowSandboxDeps> => {
    const components = await import('flowise-components')
    const config = components.getE2BConnectionConfig()
    components.assertWorkflowSandboxConfig(config)
    return {
        driver: await defaultDriver(),
        store: typeormStore(),
        config,
        live: liveSandboxes,
        locks,
        warn: (message) => logger.warn(message)
    }
}

export const releaseWorkflowSandboxForChatflow = async (chatflowId: string): Promise<{ released: boolean; sandboxId?: string }> => {
    try {
        const deps = await defaultWorkflowSandboxDeps()
        return releaseWorkflowSandbox(chatflowId, deps)
    } catch (error) {
        // Sandbox mode may be unconfigured. Still drop a stored mapping if the driver cannot start.
        logger.warn(`[sandbox] Release for chatflow ${chatflowId} skipped driver: ${(error as Error).message}`)
        const row = await typeormStore().findByChatflowId(chatflowId)
        liveSandboxes.delete(chatflowId)
        if (!row) return { released: false }
        await typeormStore().deleteByChatflowId(chatflowId)
        return { released: true, sandboxId: row.sandboxId }
    }
}

export const getWorkflowSandboxStatus = async (
    chatflowId: string
): Promise<{ attached: boolean; sandboxId?: string; template?: string }> => {
    const row = await typeormStore().findByChatflowId(chatflowId)
    if (!row) return { attached: false }
    return { attached: true, sandboxId: row.sandboxId, template: row.template }
}

export const acquireWorkflowSandbox = async (chatflowId: string) => {
    const deps = await defaultWorkflowSandboxDeps()
    const live = await getOrCreateWorkflowSandbox(chatflowId, deps)
    return {
        mode: 'ready' as const,
        chatflowId,
        sandboxId: live.sandboxId,
        sandbox: live.sandbox
    }
}
