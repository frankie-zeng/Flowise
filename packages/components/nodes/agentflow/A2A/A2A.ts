import axios from 'axios'
import { randomUUID } from 'crypto'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { A2ASessionState, assertHttpUrl, buildMessageSendRequest, parseA2AResponse } from './a2aProtocol'

class A2A_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'A2A'
        this.name = 'a2aAgentflow'
        this.version = 1.0
        this.type = 'A2A'
        this.category = 'Agent Flows'
        this.description = 'Call a remote A2A agent and keep contextId/taskId for this session. 调用远程 A2A 代理并在会话内保持上下文。'
        this.color = '#FF8A65'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Agent URL',
                name: 'a2aAgentUrl',
                type: 'string',
                placeholder: 'https://agent.example.com',
                description: 'Base URL of the remote A2A agent. JSON-RPC message/send is posted here.'
            },
            {
                label: 'Message',
                name: 'a2aMessage',
                type: 'string',
                rows: 4,
                acceptVariable: true,
                description: 'User message sent to the remote agent'
            },
            {
                label: 'Bearer Token',
                name: 'a2aBearerToken',
                type: 'password',
                optional: true,
                description: 'Optional bearer token. Leave empty for an open agent.'
            },
            {
                label: 'Timeout (ms)',
                name: 'a2aTimeoutMs',
                type: 'number',
                default: 60000,
                optional: true
            }
        ]
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const state = (options.agentflowRuntime?.state as ICommonObject) || {}
        const agentUrl = assertHttpUrl(String(nodeData.inputs?.a2aAgentUrl || ''))
        const configuredMessage = nodeData.inputs?.a2aMessage as string
        const message = configuredMessage && configuredMessage.trim() ? configuredMessage : String(input || '')
        if (!message.trim()) {
            throw new Error('A2A node requires a message')
        }

        const nodeId = nodeData.id
        const stateKey = `a2a.${nodeId}`
        let session: A2ASessionState = {}
        const stored = state[stateKey]
        if (stored && typeof stored === 'object') {
            session = { contextId: stored.contextId, taskId: stored.taskId }
        }
        if (options.a2aSession?.get) {
            const persisted = await options.a2aSession.get(nodeId)
            if (persisted) session = { ...session, ...persisted }
        }

        const messageId = randomUUID()
        const requestBody = buildMessageSendRequest(message, session, messageId)
        const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
        const bearer = nodeData.inputs?.a2aBearerToken as string
        if (bearer) headers.authorization = `Bearer ${bearer}`

        const timeoutMs = Number(nodeData.inputs?.a2aTimeoutMs) || 60000
        const response = await axios.post(agentUrl, requestBody, {
            headers,
            timeout: timeoutMs,
            validateStatus: () => true
        })
        const parsedBody = response.data
        const recordTurn = async (status: string, outputText: string, rawResponse: unknown, contextId?: string, taskId?: string) => {
            if (!options.conversation?.append) return
            await options.conversation.append({
                nodeId,
                kind: 'a2a',
                status,
                message,
                output: outputText,
                externalSession: contextId,
                externalTask: taskId,
                rawRequest: requestBody,
                rawResponse
            })
        }
        if (response.status < 200 || response.status >= 300) {
            const error = new Error(`A2A request failed with HTTP ${response.status}`)
            ;(error as any).a2a = { request: requestBody, response: parsedBody }
            await recordTurn('error', error.message, parsedBody, session.contextId, session.taskId)
            throw error
        }
        if (parsedBody?.error) {
            const error = new Error(`A2A agent error: ${parsedBody.error.message || JSON.stringify(parsedBody.error)}`)
            ;(error as any).a2a = { request: requestBody, response: parsedBody }
            await recordTurn('error', error.message, parsedBody, session.contextId, session.taskId)
            throw error
        }

        const parsed = parseA2AResponse(parsedBody)
        const nextSession: A2ASessionState = {
            contextId: parsed.contextId || session.contextId,
            taskId: parsed.taskId || session.taskId
        }
        if (options.a2aSession?.save) {
            await options.a2aSession.save(nodeId, nextSession)
        }
        const nextState = { ...state, [stateKey]: nextSession }
        await recordTurn('completed', parsed.text, parsed.raw, nextSession.contextId, nextSession.taskId)

        return {
            id: nodeData.id,
            name: this.name,
            input: { agentUrl, message, session },
            output: {
                content: parsed.text,
                a2a: {
                    request: requestBody,
                    response: parsed.raw,
                    contextId: nextSession.contextId,
                    taskId: nextSession.taskId,
                    turns: [
                        { role: 'user', text: message },
                        { role: 'agent', text: parsed.text }
                    ]
                }
            },
            state: nextState
        }
    }
}

module.exports = { nodeClass: A2A_Agentflow }
