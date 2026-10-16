import { DataSource } from 'typeorm'
import { CaoSession } from '../../database/entities/CaoSession'

export interface CaoSessionValue {
    caoSessionName: string
    terminalId?: string
    provider?: string
    agentProfile?: string
}

export const createCaoSessionStore = (appDataSource: DataSource, chatflowId: string, workspaceId?: string) => {
    const repo = appDataSource.getRepository(CaoSession)
    return {
        async get(nodeId: string): Promise<CaoSessionValue | undefined> {
            const row = await repo.findOne({ where: { chatflowId, nodeId } })
            if (!row) return undefined
            if (workspaceId && row.workspaceId && row.workspaceId !== workspaceId) return undefined
            return {
                caoSessionName: row.caoSessionName,
                terminalId: row.terminalId,
                provider: row.provider,
                agentProfile: row.agentProfile
            }
        },
        async save(nodeId: string, value: CaoSessionValue): Promise<void> {
            const existing = await repo.findOne({ where: { chatflowId, nodeId } })
            if (existing) {
                existing.caoSessionName = value.caoSessionName
                existing.terminalId = value.terminalId
                existing.provider = value.provider
                existing.agentProfile = value.agentProfile
                existing.workspaceId = workspaceId
                await repo.save(existing)
                return
            }
            await repo.save(
                repo.create({
                    chatflowId,
                    nodeId,
                    caoSessionName: value.caoSessionName,
                    terminalId: value.terminalId,
                    provider: value.provider,
                    agentProfile: value.agentProfile,
                    workspaceId
                })
            )
        }
    }
}
