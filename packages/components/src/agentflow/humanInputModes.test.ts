import { buildHumanInputActionSpec, normalizeHumanInputMode } from './humanInputModes'

describe('human input modes', () => {
    it('keeps the original approve and reject actions by default', () => {
        expect(normalizeHumanInputMode(undefined)).toBe('approve')
        expect(normalizeHumanInputMode('nope')).toBe('approve')
        const spec = buildHumanInputActionSpec('approve')
        expect(spec.elements.map((element) => element.type)).toEqual(['agentflowv2-approve-button', 'agentflowv2-reject-button'])
    })

    it('asks for free-text input on the input mode', () => {
        const spec = buildHumanInputActionSpec('input')
        expect(spec.elements).toEqual([{ type: 'agentflowv2-submit-button', label: '提交 / Submit' }])
    })

    it('asks for acknowledgement on the output mode', () => {
        const spec = buildHumanInputActionSpec('output')
        expect(spec.elements[0].type).toBe('agentflowv2-approve-button')
        expect(spec.elements).toHaveLength(1)
    })
})
