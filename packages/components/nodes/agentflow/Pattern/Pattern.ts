import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../src/Interface'
import { extractResponseContent } from '../../../src/utils'
import { buildPatternStep, isPatternComplete, normalizeCandidateCount, normalizePatternType, PatternType } from './patterns'

class Pattern_Agentflow implements INode {
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
        this.label = 'Pattern'
        this.name = 'patternAgentflow'
        this.version = 1.0
        this.type = 'Pattern'
        this.category = 'Agent Flows'
        this.description =
            'Multi-step reasoning patterns: critic, debate, best of N, and reflexion. 多步推理模式：批评、辩论、多次采样、反思。'
        this.color = '#B39DDB'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Pattern',
                name: 'patternType',
                type: 'options',
                options: [
                    { label: 'Critic / 批评', name: 'critic', description: 'Draft, critique, then revise' },
                    { label: 'Debate / 辩论', name: 'debate', description: 'Pro, con, then a judge' },
                    { label: 'Best of N / 多次采样', name: 'best_of_n', description: 'Sample N answers and keep the best' },
                    { label: 'Reflexion / 反思', name: 'reflexion', description: 'Attempt, reflect, then retry' }
                ],
                default: 'critic'
            },
            {
                label: 'Model',
                name: 'patternModel',
                type: 'asyncOptions',
                loadMethod: 'listModels',
                loadConfig: true
            },
            {
                label: 'Task',
                name: 'patternTask',
                type: 'string',
                rows: 4,
                acceptVariable: true,
                description: 'Task given to the pattern. Falls back to the incoming node input.'
            },
            {
                label: 'Candidates',
                name: 'patternCandidateCount',
                type: 'number',
                default: 3,
                optional: true,
                show: {
                    patternType: 'best_of_n'
                }
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listModels(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const componentNodes = options.componentNodes as { [key: string]: INode }
            const returnOptions: INodeOptionsValue[] = []
            for (const nodeName in componentNodes) {
                const componentNode = componentNodes[nodeName]
                if (componentNode.category === 'Chat Models') {
                    if (componentNode.tags?.includes('LlamaIndex')) continue
                    returnOptions.push({
                        label: componentNode.label,
                        name: nodeName,
                        imageSrc: componentNode.icon
                    })
                }
            }
            return returnOptions
        }
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const pattern = normalizePatternType(nodeData.inputs?.patternType)
        const candidateCount = normalizeCandidateCount(nodeData.inputs?.patternCandidateCount)
        const configuredTask = nodeData.inputs?.patternTask as string
        const task = configuredTask && String(configuredTask).trim() ? String(configuredTask) : String(input || '')
        if (!task.trim()) throw new Error('Pattern node requires a task')

        const model = nodeData.inputs?.patternModel as string
        const modelConfig = nodeData.inputs?.patternModelConfig as ICommonObject
        if (!model || !modelConfig) throw new Error('Pattern node requires a chat model')

        const llm = await this.loadModel(nodeData, model, modelConfig, options)
        const prior: Record<string, string> = {}
        const transcript: Array<{ label: string; content: string }> = []

        for (let step = 0; step < 12 && !isPatternComplete(pattern, prior, candidateCount); step++) {
            const [next] = buildPatternStep(pattern, task, prior, candidateCount)
            const response = await llm.invoke(next.messages)
            const text = extractResponseContent(response)
            prior[next.label] = text
            transcript.push({ label: next.label, content: text })
        }

        const content = finalPatternContent(pattern, prior)
        return {
            id: nodeData.id,
            name: this.name,
            input: { pattern, task, candidateCount },
            output: { content, pattern, transcript },
            state: options.agentflowRuntime?.state
        }
    }

    private async loadModel(
        nodeData: INodeData,
        model: string,
        modelConfig: ICommonObject,
        options: ICommonObject
    ): Promise<BaseChatModel> {
        const nodeInstanceFilePath = options.componentNodes[model].filePath as string
        const nodeModule = await import(nodeInstanceFilePath)
        const newNodeInstance = new nodeModule.nodeClass()
        const newNodeData = {
            ...nodeData,
            credential: modelConfig['FLOWISE_CREDENTIAL_ID'],
            inputs: { ...nodeData.inputs, ...modelConfig }
        }
        return (await newNodeInstance.init(newNodeData, '', options)) as BaseChatModel
    }
}

const finalPatternContent = (pattern: PatternType, prior: Record<string, string>): string => {
    if (pattern === 'critic') return prior.revision || prior.draft || ''
    if (pattern === 'debate') return prior.judge || prior.pro || ''
    if (pattern === 'reflexion') return prior.retry || prior.attempt || ''
    return prior.judge || ''
}

module.exports = { nodeClass: Pattern_Agentflow }
