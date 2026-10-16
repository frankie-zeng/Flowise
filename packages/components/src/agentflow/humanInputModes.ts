export type HumanInputMode = 'approve' | 'input' | 'output'

export interface HumanInputElement {
    type: string
    label: string
}

export interface HumanInputActionSpec {
    mapping: Record<string, string>
    elements: HumanInputElement[]
}

/** Missing or unknown values stay on the original approve/reject behavior. */
export const normalizeHumanInputMode = (value: unknown): HumanInputMode => {
    if (value === 'input' || value === 'output' || value === 'approve') return value
    return 'approve'
}

export const buildHumanInputActionSpec = (mode: HumanInputMode): HumanInputActionSpec => {
    if (mode === 'input') {
        return {
            mapping: { approve: 'Submit', reject: 'Reject' },
            elements: [{ type: 'agentflowv2-submit-button', label: '提交 / Submit' }]
        }
    }
    if (mode === 'output') {
        return {
            mapping: { approve: 'Acknowledge', reject: 'Reject' },
            elements: [{ type: 'agentflowv2-approve-button', label: '确认 / Acknowledge' }]
        }
    }
    return {
        mapping: { approve: 'Proceed', reject: 'Reject' },
        elements: [
            { type: 'agentflowv2-approve-button', label: 'Proceed' },
            { type: 'agentflowv2-reject-button', label: 'Reject' }
        ]
    }
}
