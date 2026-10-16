export const PATTERN_TYPES = ['critic', 'debate', 'best_of_n', 'reflexion'] as const
export type PatternType = (typeof PATTERN_TYPES)[number]

export interface PatternStep {
    label: string
    messages: Array<{ role: 'system' | 'user'; content: string }>
}

export const normalizePatternType = (value: unknown): PatternType => {
    if (value === 'critic' || value === 'debate' || value === 'best_of_n' || value === 'reflexion') return value
    return 'critic'
}

export const normalizeCandidateCount = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(parsed)) return 3
    return Math.min(8, Math.max(2, parsed))
}

const system = (content: string) => ({ role: 'system' as const, content })
const user = (content: string) => ({ role: 'user' as const, content })

/**
 * Build the LLM steps for a Binex-style pattern. Each step sees the task and
 * the outputs of earlier steps via the `prior` map filled by the node.
 */
export const buildPatternStep = (pattern: PatternType, task: string, prior: Record<string, string>, candidateCount = 3): PatternStep[] => {
    if (pattern === 'critic') {
        if (!prior.draft) {
            return [
                {
                    label: 'draft',
                    messages: [system('You write a direct answer to the task. Return only the answer.'), user(task)]
                }
            ]
        }
        if (!prior.critique) {
            return [
                {
                    label: 'critique',
                    messages: [
                        system('You are a critic. List concrete problems with the draft. Do not rewrite it yet.'),
                        user(`Task:\n${task}\n\nDraft:\n${prior.draft}`)
                    ]
                }
            ]
        }
        return [
            {
                label: 'revision',
                messages: [
                    system('Revise the draft using the critique. Return only the improved answer.'),
                    user(`Task:\n${task}\n\nDraft:\n${prior.draft}\n\nCritique:\n${prior.critique}`)
                ]
            }
        ]
    }

    if (pattern === 'debate') {
        if (!prior.pro) {
            return [
                {
                    label: 'pro',
                    messages: [system('Argue in favor of the strongest useful answer to the task.'), user(task)]
                }
            ]
        }
        if (!prior.con) {
            return [
                {
                    label: 'con',
                    messages: [
                        system('Argue against the previous position and surface risks or missing points.'),
                        user(`Task:\n${task}\n\nPosition:\n${prior.pro}`)
                    ]
                }
            ]
        }
        return [
            {
                label: 'judge',
                messages: [
                    system('Judge the debate and return the best final answer to the task.'),
                    user(`Task:\n${task}\n\nFor:\n${prior.pro}\n\nAgainst:\n${prior.con}`)
                ]
            }
        ]
    }

    if (pattern === 'reflexion') {
        if (!prior.attempt) {
            return [
                {
                    label: 'attempt',
                    messages: [system('Attempt the task. Return only the answer.'), user(task)]
                }
            ]
        }
        if (!prior.reflection) {
            return [
                {
                    label: 'reflection',
                    messages: [
                        system('Reflect on what is wrong or incomplete in the attempt. Be specific.'),
                        user(`Task:\n${task}\n\nAttempt:\n${prior.attempt}`)
                    ]
                }
            ]
        }
        return [
            {
                label: 'retry',
                messages: [
                    system('Try the task again using the reflection. Return only the improved answer.'),
                    user(`Task:\n${task}\n\nAttempt:\n${prior.attempt}\n\nReflection:\n${prior.reflection}`)
                ]
            }
        ]
    }

    const produced = Object.keys(prior).filter((key) => key.startsWith('candidate_')).length
    if (produced < candidateCount) {
        const index = produced + 1
        return [
            {
                label: `candidate_${index}`,
                messages: [
                    system(`Produce candidate answer ${index} of ${candidateCount}. Make it independently useful. Return only the answer.`),
                    user(task)
                ]
            }
        ]
    }
    const candidates = Object.entries(prior)
        .filter(([key]) => key.startsWith('candidate_'))
        .map(([key, value]) => `${key}:\n${value}`)
        .join('\n\n')
    return [
        {
            label: 'judge',
            messages: [
                system('Pick the best candidate and return that answer, lightly edited only if needed. Do not explain the choice.'),
                user(`Task:\n${task}\n\nCandidates:\n${candidates}`)
            ]
        }
    ]
}

export const isPatternComplete = (pattern: PatternType, prior: Record<string, string>, candidateCount = 3): boolean => {
    if (pattern === 'critic') return Boolean(prior.revision)
    if (pattern === 'debate') return Boolean(prior.judge)
    if (pattern === 'reflexion') return Boolean(prior.retry)
    return Boolean(prior.judge) && Object.keys(prior).filter((key) => key.startsWith('candidate_')).length >= candidateCount
}
