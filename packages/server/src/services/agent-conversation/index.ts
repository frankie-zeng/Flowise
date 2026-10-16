import { DataSource } from 'typeorm'
import { AgentConversationTurn } from '../../database/entities/AgentConversationTurn'

const MAX_TEXT = 100_000

export interface ConversationTurnInput {
    nodeId: string
    kind: 'a2a' | 'cao'
    status?: string
    message?: string
    output?: string
    externalSession?: string
    externalTask?: string
    rawRequest?: unknown
    rawResponse?: unknown
}

export interface ConversationScope {
    workspaceId?: string
    chatflowId: string
    sessionId: string
    executionId?: string
}

const clip = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) + '\n/* truncated */' : value
}

const toJson = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    try {
        return clip(JSON.stringify(value))
    } catch {
        return clip(JSON.stringify({ error: 'unserializable' }))
    }
}

export const filterConversationTurns = (
    rows: AgentConversationTurn[],
    query: { workspaceId?: string; chatflowId: string; nodeId?: string }
): AgentConversationTurn[] => {
    return rows
        .filter((row) => row.chatflowId === query.chatflowId)
        .filter((row) => !query.workspaceId || row.workspaceId === query.workspaceId)
        .filter((row) => !query.nodeId || row.nodeId === query.nodeId)
        .sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime())
}

export const createConversationRecorder = (appDataSource: DataSource, scope: ConversationScope) => {
    const repo = appDataSource.getRepository(AgentConversationTurn)
    return {
        async append(turn: ConversationTurnInput): Promise<void> {
            if (!scope.workspaceId || !scope.chatflowId || !turn.nodeId) return
            await repo.save(
                repo.create({
                    workspaceId: scope.workspaceId,
                    chatflowId: scope.chatflowId,
                    sessionId: scope.sessionId || '',
                    executionId: scope.executionId,
                    nodeId: turn.nodeId,
                    kind: turn.kind,
                    status: turn.status,
                    message: clip(turn.message),
                    output: clip(turn.output),
                    externalSession: turn.externalSession,
                    externalTask: turn.externalTask,
                    rawRequest: toJson(turn.rawRequest),
                    rawResponse: toJson(turn.rawResponse)
                })
            )
        }
    }
}

export const listConversationTurns = async (
    appDataSource: DataSource,
    query: { workspaceId?: string; chatflowId: string; nodeId?: string }
): Promise<AgentConversationTurn[]> => {
    const repo = appDataSource.getRepository(AgentConversationTurn)
    const rows = await repo.find({ where: { chatflowId: query.chatflowId } })
    return filterConversationTurns(rows, query)
}
