import { buildCaoPrompt, executeCao, normalizeCaoConfig, resolveSessionName, sessionNameForFlow } from './caoClient'

const identity = { chatflowId: 'flow-1', nodeId: 'node-1' }

const baseInputs = {
    caoProvider: 'claude_code',
    caoAgentProfile: 'developer',
    caoMode: 'handoff',
    caoTask: 'fix the test'
}

describe('CAO client', () => {
    it('keeps one session name for a flow node', () => {
        expect(sessionNameForFlow(identity)).toBe(sessionNameForFlow(identity))
        expect(sessionNameForFlow(identity)).not.toBe(sessionNameForFlow({ ...identity, nodeId: 'node-2' }))
    })

    it('prefers the node URL, then the credential, then the environment', () => {
        const config = normalizeCaoConfig(
            baseInputs,
            { CAO_SERVER_URL: 'http://env.example:9889' },
            { serverUrl: 'http://cred.example:9889' }
        )
        expect(config.serverUrl).toBe('http://cred.example:9889')
        const overridden = normalizeCaoConfig(
            { ...baseInputs, caoServerUrl: 'https://node.example/cao/' },
            { CAO_SERVER_URL: 'http://env.example:9889' },
            { serverUrl: 'http://cred.example:9889' }
        )
        expect(overridden.serverUrl).toBe('https://node.example/cao')
    })

    it('reuses the saved terminal on handoff and does not tear it down', async () => {
        const config = normalizeCaoConfig(baseInputs, { CAO_SERVER_URL: 'http://cao.example:9889' })
        expect(config.teardown).toBe(false)
        expect(config.wait).toBe(true)
        const calls: string[] = []
        const result = await executeCao(config, { caoSessionName: 'kept', terminalId: 'abcd1234' }, identity, async (request) => {
            calls.push(`${request.method} ${request.url}`)
            if (request.url.endsWith('/sessions')) return { status: 201, data: { id: 't0' } }
            const body = request.body as { reuse_terminal_id?: string; teardown?: boolean }
            expect(body.reuse_terminal_id).toBe('abcd1234')
            expect(body.teardown).toBe(false)
            return { status: 200, data: { terminal_id: 'abcd1234', last_message: 'done', status: 'completed' } }
        })
        expect(result.sessionName).toBe('kept')
        expect(result.terminalId).toBe('abcd1234')
        expect(result.content).toBe('done')
        expect(calls.some((item) => item.includes('/terminals/run-step'))).toBe(true)
    })

    it('returns immediately for assign unless wait is requested', async () => {
        const config = normalizeCaoConfig(
            { ...baseInputs, caoMode: 'assign', caoProvider: 'codex' },
            { CAO_SERVER_URL: 'http://cao.example:9889' }
        )
        expect(config.wait).toBe(false)
        const result = await executeCao(config, undefined, identity, async (request) => {
            if (request.url.endsWith('/sessions')) return { status: 201, data: {} }
            if (request.url.includes('/terminals') && request.method === 'POST' && !request.url.endsWith('/input')) {
                return { status: 201, data: { terminal_id: 'ffff0000' } }
            }
            return { status: 200, data: { ok: true } }
        })
        expect(result.status).toBe('accepted')
        expect(result.terminalId).toBe('ffff0000')
        expect(resolveSessionName(config, { caoSessionName: result.sessionName }, identity)).toBe(result.sessionName)
    })

    it('sends inbox messages to the saved terminal', async () => {
        const config = normalizeCaoConfig(
            { ...baseInputs, caoMode: 'send_message', caoInjectSenderId: true, caoCallerId: 'abcabcab' },
            { CAO_SERVER_URL: 'http://cao.example:9889' }
        )
        let inbox: any
        const result = await executeCao(config, { caoSessionName: 'kept', terminalId: 'abcd1234' }, identity, async (request) => {
            if (request.url.includes('/inbox/messages')) inbox = request.body
            return { status: request.url.endsWith('/sessions') ? 409 : 200, data: { queued: true } }
        })
        expect(result.terminalId).toBe('abcd1234')
        expect(inbox.sender_id).toBe('abcabcab')
        expect(inbox.message).toContain('(sender: abcabcab)')
    })

    it('shapes Codex prompts with the terminal id', () => {
        const config = normalizeCaoConfig({ ...baseInputs, caoProvider: 'codex' }, { CAO_SERVER_URL: 'http://cao.example:9889' })
        expect(buildCaoPrompt(config, 'abcd1234')).toContain('CAO_TERMINAL_ID=abcd1234')
        expect(buildCaoPrompt({ ...config, shapePrompt: false }, 'abcd1234')).toBe('fix the test')
    })

    it('rejects a missing server URL', () => {
        expect(() => normalizeCaoConfig(baseInputs, {})).toThrow(/http/)
    })

    it('redacts env vars in the recorded call and rejects a short job id', async () => {
        const config = normalizeCaoConfig(
            { ...baseInputs, caoEnvVars: '{"TOKEN":"secret"}', caoJobId: '0123456789abcdef0123456789abcdef' },
            { CAO_SERVER_URL: 'http://cao.example:9889' }
        )
        let sent: any
        const result = await executeCao(config, { caoSessionName: 'kept' }, identity, async (request) => {
            if (request.url.endsWith('/sessions')) {
                sent = request.body
                return { status: 201, data: {} }
            }
            return { status: 200, data: { terminal_id: 'abcd1234', last_message: 'ok', status: 'completed' } }
        })
        expect(sent.env_vars.TOKEN).toBe('secret')
        const recorded = (result.request as Array<{ path: string; body?: { env_vars?: string } }>).find((item) => item.path === '/sessions')
        expect(recorded?.body?.env_vars).toBe('[redacted]')
        expect(() => normalizeCaoConfig({ ...baseInputs, caoJobId: 'nope' }, { CAO_SERVER_URL: 'http://cao.example:9889' })).toThrow(
            /job id/
        )
    })
})
