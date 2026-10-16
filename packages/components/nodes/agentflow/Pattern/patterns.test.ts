import { buildPatternStep, isPatternComplete, normalizeCandidateCount, normalizePatternType } from './patterns'

describe('pattern steps', () => {
    it('runs critic as draft, critique, then revision', () => {
        expect(buildPatternStep('critic', 'ship it', {})[0].label).toBe('draft')
        expect(buildPatternStep('critic', 'ship it', { draft: 'v1' })[0].label).toBe('critique')
        expect(buildPatternStep('critic', 'ship it', { draft: 'v1', critique: 'weak' })[0].label).toBe('revision')
        expect(isPatternComplete('critic', { revision: 'v2' })).toBe(true)
    })

    it('runs debate as pro, con, then judge', () => {
        expect(buildPatternStep('debate', 'choose', {})[0].label).toBe('pro')
        expect(buildPatternStep('debate', 'choose', { pro: 'yes' })[0].label).toBe('con')
        expect(buildPatternStep('debate', 'choose', { pro: 'yes', con: 'no' })[0].label).toBe('judge')
    })

    it('runs best_of_n candidates before the judge', () => {
        expect(normalizeCandidateCount('9')).toBe(8)
        expect(normalizeCandidateCount('nope')).toBe(3)
        expect(buildPatternStep('best_of_n', 'task', {}, 2)[0].label).toBe('candidate_1')
        expect(buildPatternStep('best_of_n', 'task', { candidate_1: 'a' }, 2)[0].label).toBe('candidate_2')
        expect(buildPatternStep('best_of_n', 'task', { candidate_1: 'a', candidate_2: 'b' }, 2)[0].label).toBe('judge')
        expect(isPatternComplete('best_of_n', { candidate_1: 'a', candidate_2: 'b', judge: 'a' }, 2)).toBe(true)
    })

    it('runs reflexion as attempt, reflection, then retry', () => {
        expect(normalizePatternType('unknown')).toBe('critic')
        expect(buildPatternStep('reflexion', 'task', {})[0].label).toBe('attempt')
        expect(buildPatternStep('reflexion', 'task', { attempt: 'a' })[0].label).toBe('reflection')
        expect(buildPatternStep('reflexion', 'task', { attempt: 'a', reflection: 'fix' })[0].label).toBe('retry')
    })
})
