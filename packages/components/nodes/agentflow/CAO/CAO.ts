import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import axios from 'axios'
import { CAO_PROVIDERS, CaoHttp, executeCao, normalizeCaoConfig } from './caoClient'

const providerOptions = CAO_PROVIDERS.map((item) => ({ label: item.label, name: item.name }))

class CAO_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'CAO'
        this.name = 'caoAgentflow'
        this.version = 1.0
        this.type = 'CAO'
        this.category = 'Agent Flows'
        this.description =
            'Run a task on AWS CLI Agent Orchestrator (cao-server). Choose a provider, then set profile, mode, and session options. 通过 CAO 调用 Claude Code、Codex、Cursor、Q CLI 等。'
        this.color = '#FF9900'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'CAO Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['caoApi'],
            optional: true,
            additionalParams: true,
            description: 'Optional cao-server URL and bearer token. CAO_SERVER_URL is used when this is empty.'
        }
        this.inputs = [
            {
                label: 'Provider',
                name: 'caoProvider',
                type: 'options',
                options: providerOptions,
                default: 'claude_code',
                description: 'CLI tool cao-server launches in the terminal.'
            },
            {
                label: 'Agent Profile',
                name: 'caoAgentProfile',
                type: 'string',
                default: 'developer',
                acceptVariable: true,
                placeholder: 'developer',
                description: 'CAO agent profile name. Defaults to developer, or CAO_AGENT_PROFILE.'
            },
            {
                label: 'Mode',
                name: 'caoMode',
                type: 'options',
                options: [
                    { label: 'Handoff (wait)', name: 'handoff', description: 'POST /terminals/run-step and wait' },
                    { label: 'Assign (background)', name: 'assign', description: 'Create or reuse a terminal and return' },
                    { label: 'Send Message', name: 'send_message', description: 'Queue a message on a terminal inbox' }
                ],
                default: 'handoff'
            },
            {
                label: 'Task',
                name: 'caoTask',
                type: 'string',
                rows: 4,
                acceptVariable: true,
                placeholder: 'Describe the work for the CLI agent',
                description: 'Prompt sent to the agent. When this is empty, the incoming node input is used.'
            },
            {
                label: 'Server URL',
                name: 'caoServerUrl',
                type: 'string',
                optional: true,
                additionalParams: true,
                acceptVariable: true,
                placeholder: 'http://127.0.0.1:9889',
                description: 'Overrides the credential and CAO_SERVER_URL for this node.'
            },
            {
                label: 'Bearer Token',
                name: 'caoBearerToken',
                type: 'password',
                optional: true,
                additionalParams: true,
                description: 'Overrides the credential token and CAO_BEARER_TOKEN. Not stored in the conversation record.'
            },
            {
                label: 'Session Name',
                name: 'caoSessionName',
                type: 'string',
                optional: true,
                additionalParams: true,
                acceptVariable: true,
                description: 'Leave empty to reuse the session saved for this flow and node.'
            },
            {
                label: 'Reuse Terminal',
                name: 'caoReuseTerminal',
                type: 'boolean',
                default: true,
                optional: true,
                additionalParams: true,
                description: 'Keep using the terminal id saved from the previous run of this flow.'
            },
            {
                label: 'Tear Down After Handoff',
                name: 'caoTeardown',
                type: 'boolean',
                default: false,
                optional: true,
                additionalParams: true,
                show: { caoMode: 'handoff' },
                description: 'Delete the terminal when run-step finishes. Off so the session survives the next run.'
            },
            {
                label: 'Timeout (seconds)',
                name: 'caoTimeoutSeconds',
                type: 'number',
                default: 600,
                optional: true,
                additionalParams: true,
                description: 'Max wait for handoff or for polling. cao-server run-step default is 600.'
            },
            {
                label: 'Wait Behavior',
                name: 'caoWaitBehavior',
                type: 'options',
                options: [
                    { label: 'Follow mode', name: 'default', description: 'Handoff waits. Assign and send_message return.' },
                    { label: 'Wait until completed', name: 'wait' },
                    { label: 'Return after submit', name: 'return' }
                ],
                default: 'default',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Poll Interval (seconds)',
                name: 'caoPollIntervalSeconds',
                type: 'number',
                default: 2,
                optional: true,
                additionalParams: true,
                description: 'How often to read terminal status when waiting outside run-step.'
            },
            {
                label: 'Working Directory',
                name: 'caoWorkingDirectory',
                type: 'string',
                optional: true,
                additionalParams: true,
                acceptVariable: true,
                description: 'Working directory for a newly created terminal.'
            },
            {
                label: 'Caller Terminal Id',
                name: 'caoCallerId',
                type: 'string',
                optional: true,
                additionalParams: true,
                placeholder: '8 hex characters',
                description: 'Supervisor terminal id recorded for callback routing (caller_id).'
            },
            {
                label: 'Receiver Terminal Id',
                name: 'caoReceiverId',
                type: 'string',
                optional: true,
                additionalParams: true,
                show: { caoMode: 'send_message' },
                description: 'Inbox target. Leave empty to use the terminal saved for this flow.'
            },
            {
                label: 'Allowed Tools',
                name: 'caoAllowedTools',
                type: 'string',
                optional: true,
                additionalParams: true,
                placeholder: 'handoff,assign,send_message',
                description: 'Comma-separated CAO allowed-tools list for a new terminal.'
            },
            {
                label: 'Use Git Worktree',
                name: 'caoUseWorktree',
                type: 'boolean',
                default: false,
                optional: true,
                additionalParams: true,
                description: 'Ask cao-server to provision an isolated git worktree for a new terminal.'
            },
            {
                label: 'Memory Manager Sidecar',
                name: 'caoMemoryManager',
                type: 'boolean',
                default: false,
                optional: true,
                additionalParams: true,
                description: 'Pass memory_manager on session create so CAO starts a memory sidecar.'
            },
            {
                label: 'Env Vars (JSON)',
                name: 'caoEnvVars',
                type: 'string',
                rows: 4,
                optional: true,
                additionalParams: true,
                acceptVariable: true,
                placeholder: '{"FOO":"bar"}',
                description: 'Object forwarded as env_vars on session create. Not written to the conversation log.'
            },
            {
                label: 'Claim Id',
                name: 'caoClaimId',
                type: 'string',
                optional: true,
                additionalParams: true,
                description: '32 lowercase hex claim for a new terminal. Ignored when reusing a terminal.'
            },
            {
                label: 'Group (JSON)',
                name: 'caoGroup',
                type: 'string',
                optional: true,
                additionalParams: true,
                placeholder: '["team","project"]',
                description: 'Peer-discovery group array sent with session create.'
            },
            {
                label: 'Metadata (JSON)',
                name: 'caoMetadata',
                type: 'string',
                optional: true,
                additionalParams: true,
                placeholder: '{"ticket":"1"}',
                description: 'Free-form metadata object sent with session create.'
            },
            {
                label: 'Shape Provider Prompt',
                name: 'caoShapePrompt',
                type: 'boolean',
                default: true,
                optional: true,
                additionalParams: true,
                description: 'For Codex, prefix the task with CAO_TERMINAL_ID the way CAO handoff does.'
            },
            {
                label: 'Inject Sender Id',
                name: 'caoInjectSenderId',
                type: 'boolean',
                default: false,
                optional: true,
                additionalParams: true,
                description: 'Append the caller terminal id to the message, matching CAO sender-id injection.'
            },
            {
                label: 'Job Id',
                name: 'caoJobId',
                type: 'string',
                optional: true,
                additionalParams: true,
                description: 'Optional 32-hex job id for durable handoff results (GET /handoff-results/{job_id}).'
            }
        ]
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const credentialId = (nodeData.credential as any) || ''
        const credentialData = await getCredentialData(credentialId, options)
        const credential = {
            serverUrl: getCredentialParam('serverUrl', credentialData, nodeData),
            bearerToken: getCredentialParam('bearerToken', credentialData, nodeData)
        }
        const inputs = { ...(nodeData.inputs || {}) }
        if (!inputs.caoTask && input) inputs.caoTask = input
        const config = normalizeCaoConfig(inputs, process.env, credential)
        const nodeId = String(nodeData.id || '')
        const persisted = options.caoSession?.get ? await options.caoSession.get(nodeId) : undefined
        const http: CaoHttp = async (request) => {
            const response = await axios.request({
                method: request.method,
                url: request.url,
                params: request.query,
                data: request.body,
                headers: request.headers,
                timeout: request.timeoutMs,
                validateStatus: () => true
            })
            return { status: response.status, data: response.data }
        }
        const identity = { chatflowId: String(options.chatflowId || options.chatflowid || ''), nodeId }
        try {
            const result = await executeCao(config, persisted, identity, http)
            if (options.caoSession?.save) {
                await options.caoSession.save(nodeId, {
                    caoSessionName: result.sessionName,
                    terminalId: result.terminalId,
                    provider: config.provider,
                    agentProfile: config.agentProfile
                })
            }
            const turn = {
                nodeId,
                kind: 'cao',
                status: result.status,
                message: config.task,
                output: result.content,
                externalSession: result.sessionName,
                externalTask: result.terminalId,
                rawRequest: result.request,
                rawResponse: result.response
            }
            if (options.conversation?.append) await options.conversation.append(turn)
            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    provider: config.provider,
                    agentProfile: config.agentProfile,
                    mode: config.mode,
                    task: config.task
                },
                output: {
                    content: result.content,
                    cao: {
                        provider: config.provider,
                        agentProfile: config.agentProfile,
                        mode: config.mode,
                        status: result.status,
                        sessionName: result.sessionName,
                        terminalId: result.terminalId,
                        request: result.request,
                        response: result.response,
                        turns: [
                            { role: 'user', text: config.task },
                            { role: 'agent', text: result.content }
                        ]
                    }
                },
                state: options.agentflowRuntime?.state
            }
        } catch (error) {
            const cao = (error as any).cao
            if (options.conversation?.append) {
                await options.conversation.append({
                    nodeId,
                    kind: 'cao',
                    status: 'error',
                    message: config.task,
                    output: (error as Error).message,
                    externalSession: cao?.sessionName,
                    externalTask: cao?.terminalId,
                    rawRequest: cao?.request,
                    rawResponse: cao?.response || { message: (error as Error).message }
                })
            }
            throw error
        }
    }
}

module.exports = { nodeClass: CAO_Agentflow }
