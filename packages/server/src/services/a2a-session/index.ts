import { DataSource } from 'typeorm'
import { A2ASession } from '../../database/entities/A2ASession'

export interface A2ASessionValue {
    contextId?: string
    taskId?: string
}

export const createA2ASessionStore = (appDataSource: DataSource, chatflowId: string, sessionId: string) => {
    const repo = appDataSource.getRepository(A2ASession)
    return {
        async get(nodeId: string): Promise<A2ASessionValue | undefined> {
            const row = await repo.findOne({ where: { chatflowId, sessionId, nodeId } })
            if (!row) return undefined
            return { contextId: row.contextId, taskId: row.taskId }
        },
        async save(nodeId: string, value: A2ASessionValue): Promise<void> {
            const existing = await repo.findOne({ where: { chatflowId, sessionId, nodeId } })
            if (existing) {
                existing.contextId = value.contextId
                existing.taskId = value.taskId
                await repo.save(existing)
                return
            }
            await repo.save(repo.create({ chatflowId, sessionId, nodeId, contextId: value.contextId, taskId: value.taskId }))
        }
    }
}

export const deleteA2ASessionsForChatflow = async (appDataSource: DataSource, chatflowId: string): Promise<void> => {
    await appDataSource.getRepository(A2ASession).delete({ chatflowId })
}
