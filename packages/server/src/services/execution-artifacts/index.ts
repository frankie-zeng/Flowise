import { addSingleFileToStorage, getFileFromStorage } from 'flowise-components'
import { DataSource } from 'typeorm'
import { ExecutionArtifact } from '../../database/entities/ExecutionArtifact'
import logger from '../../utils/logger'

export interface StoredArtifactRef {
    id: string
    kind: string
    fileName: string
    mimeType?: string
    size?: number
}

const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'YES'])

export const isExecutionArtifactsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
    return TRUE_VALUES.has(env.EXECUTION_ARTIFACTS_ENABLED || '')
}

const safeJson = (value: unknown): string => {
    const seen = new WeakSet<object>()
    try {
        return (
            JSON.stringify(value ?? null, (_key, item) => {
                if (typeof item === 'bigint') return item.toString()
                if (typeof item === 'object' && item !== null) {
                    if (seen.has(item)) return '[Circular]'
                    seen.add(item)
                }
                return item
            }) ?? 'null'
        )
    } catch {
        return JSON.stringify({ error: 'unserializable' })
    }
}

const maxBytes = (): number => {
    const parsed = parseInt(process.env.EXECUTION_ARTIFACT_MAX_BYTES || '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2_000_000
}

export const persistNodeExecutionArtifacts = async (params: {
    appDataSource: DataSource
    orgId?: string
    workspaceId?: string
    chatflowId: string
    executionId: string
    sessionId: string
    nodeId: string
    nodeLabel?: string
    input: unknown
    output: unknown
}): Promise<StoredArtifactRef[]> => {
    if (!isExecutionArtifactsEnabled() || !params.orgId || !params.workspaceId || !params.executionId) return []

    const files: Array<{ kind: string; fileName: string; mimeType: string; body: string }> = [
        { kind: 'input', fileName: 'input.json', mimeType: 'application/json', body: safeJson(params.input) },
        { kind: 'output', fileName: 'output.json', mimeType: 'application/json', body: safeJson(params.output) }
    ]

    const output = params.output as
        | { a2a?: { request?: unknown; response?: unknown }; cao?: { request?: unknown; response?: unknown }; files?: Array<any> }
        | undefined
    if (output?.a2a?.request) {
        files.push({ kind: 'a2a-request', fileName: 'a2a-request.json', mimeType: 'application/json', body: safeJson(output.a2a.request) })
    }
    if (output?.a2a?.response) {
        files.push({
            kind: 'a2a-response',
            fileName: 'a2a-response.json',
            mimeType: 'application/json',
            body: safeJson(output.a2a.response)
        })
    }
    if (output?.cao?.request) {
        files.push({ kind: 'cao-request', fileName: 'cao-request.json', mimeType: 'application/json', body: safeJson(output.cao.request) })
    }
    if (output?.cao?.response) {
        files.push({
            kind: 'cao-response',
            fileName: 'cao-response.json',
            mimeType: 'application/json',
            body: safeJson(output.cao.response)
        })
    }
    if (Array.isArray(output?.files)) {
        output.files.slice(0, 20).forEach((file, index) => {
            if (!file || typeof file.content !== 'string') return
            const name = String(file.name || `file-${index}.txt`).replace(/[^a-zA-Z0-9._-]/g, '_')
            files.push({
                kind: 'file',
                fileName: name,
                mimeType: String(file.mimeType || 'text/plain'),
                body: file.content
            })
        })
    }

    const limit = maxBytes()
    const paths = [params.orgId, params.chatflowId, 'executions', params.executionId, params.nodeId.replace(/[^a-zA-Z0-9._-]/g, '_')]
    const repo = params.appDataSource.getRepository(ExecutionArtifact)
    const refs: StoredArtifactRef[] = []

    for (const file of files) {
        let body = file.body
        if (Buffer.byteLength(body) > limit) {
            body = body.slice(0, limit) + '\n/* truncated */'
        }
        try {
            const buffer = Buffer.from(body)
            await addSingleFileToStorage(file.mimeType, buffer, file.fileName, ...paths)
            const row = await repo.save(
                repo.create({
                    executionId: params.executionId,
                    agentflowId: params.chatflowId,
                    sessionId: params.sessionId,
                    nodeId: params.nodeId,
                    nodeLabel: params.nodeLabel,
                    kind: file.kind,
                    storagePath: JSON.stringify(paths),
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    size: buffer.length,
                    workspaceId: params.workspaceId
                })
            )
            refs.push({ id: row.id, kind: row.kind, fileName: row.fileName, mimeType: row.mimeType, size: row.size })
        } catch (error) {
            logger.error(`[artifacts] Failed to store ${file.kind} for node ${params.nodeId}: ${(error as Error).message}`)
        }
    }
    return refs
}

export const readExecutionArtifact = async (appDataSource: DataSource, executionId: string, artifactId: string, workspaceId?: string) => {
    const repo = appDataSource.getRepository(ExecutionArtifact)
    const row = await repo.findOne({ where: { id: artifactId, executionId } })
    if (!row) return null
    if (workspaceId && row.workspaceId !== workspaceId) return null
    const paths = JSON.parse(row.storagePath) as string[]
    const buffer = await getFileFromStorage(row.fileName, ...paths)
    const mimeType = row.mimeType || 'application/octet-stream'
    const text = mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript')
    return {
        id: row.id,
        kind: row.kind,
        fileName: row.fileName,
        mimeType,
        encoding: text ? 'utf8' : 'base64',
        content: text ? buffer.toString('utf8') : buffer.toString('base64')
    }
}
