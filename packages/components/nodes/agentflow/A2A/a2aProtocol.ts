export interface A2ASessionState {
    contextId?: string
    taskId?: string
}

export interface A2AMessageRequest {
    jsonrpc: '2.0'
    id: string
    method: 'message/send'
    params: {
        message: {
            role: 'user'
            messageId: string
            parts: Array<{ kind: 'text'; text: string }>
            contextId?: string
            taskId?: string
        }
    }
}

export const buildMessageSendRequest = (message: string, session: A2ASessionState, messageId: string): A2AMessageRequest => {
    const payload: A2AMessageRequest = {
        jsonrpc: '2.0',
        id: messageId,
        method: 'message/send',
        params: {
            message: {
                role: 'user',
                messageId,
                parts: [{ kind: 'text', text: message }]
            }
        }
    }
    if (session.contextId) payload.params.message.contextId = session.contextId
    if (session.taskId) payload.params.message.taskId = session.taskId
    return payload
}

const collectText = (value: any, out: string[]): void => {
    if (!value) return
    if (typeof value === 'string') {
        out.push(value)
        return
    }
    if (Array.isArray(value)) {
        for (const item of value) collectText(item, out)
        return
    }
    if (typeof value === 'object') {
        if (typeof value.text === 'string') out.push(value.text)
        if (value.parts) collectText(value.parts, out)
        if (value.message) collectText(value.message, out)
        if (value.artifacts) collectText(value.artifacts, out)
        if (value.status) collectText(value.status, out)
    }
}

export interface ParsedA2AResponse {
    text: string
    contextId?: string
    taskId?: string
    raw: any
}

export const parseA2AResponse = (body: any): ParsedA2AResponse => {
    const result = body?.result ?? body
    const texts: string[] = []
    collectText(result, texts)
    const contextId = result?.contextId || result?.message?.contextId || body?.result?.contextId
    const taskId = result?.taskId || result?.id || result?.task?.id
    const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))]
    return {
        text: unique.join('\n'),
        contextId: typeof contextId === 'string' ? contextId : undefined,
        taskId: typeof taskId === 'string' ? taskId : undefined,
        raw: body
    }
}

export const assertHttpUrl = (value: string): string => {
    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        throw new Error('A2A agent URL must be an absolute http(s) URL')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('A2A agent URL must use http or https')
    }
    return parsed.toString().replace(/\/$/, '')
}
