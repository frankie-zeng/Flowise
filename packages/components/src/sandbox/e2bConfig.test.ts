import { assertWorkflowSandboxConfig, getE2BConnectionConfig, isWorkflowSandboxEnabled, toE2BCreateOptions } from './e2bConfig'

describe('e2b connection config', () => {
    const env = {} as NodeJS.ProcessEnv

    it('does not default the API host to api.e2b.dev', () => {
        const config = getE2BConnectionConfig(env)
        expect(config.apiUrl).toBeUndefined()
        expect(JSON.stringify(toE2BCreateOptions(config))).not.toContain('e2b.dev')
    })

    it('reads ACS-compatible endpoint settings from the environment', () => {
        const config = getE2BConnectionConfig({
            E2B_API_KEY: 'key-1',
            E2B_API_URL: 'https://sandbox.acs.example.com',
            E2B_DOMAIN: 'sandbox.acs.example.com',
            E2B_TEMPLATE: 'code-interpreter',
            E2B_SANDBOX_TIMEOUT_MS: '600000'
        })
        expect(config).toEqual({
            apiKey: 'key-1',
            apiUrl: 'https://sandbox.acs.example.com',
            domain: 'sandbox.acs.example.com',
            template: 'code-interpreter',
            timeoutMs: 600000
        })
        expect(toE2BCreateOptions(config).apiUrl).toBe('https://sandbox.acs.example.com')
    })

    it('accepts the legacy E2B_APIKEY name', () => {
        expect(getE2BConnectionConfig({ E2B_APIKEY: 'legacy' }).apiKey).toBe('legacy')
    })

    it('enables the per-workflow sandbox only when the flag is set', () => {
        expect(isWorkflowSandboxEnabled({})).toBe(false)
        expect(isWorkflowSandboxEnabled({ WORKFLOW_SANDBOX_ENABLED: '1' })).toBe(true)
        expect(isWorkflowSandboxEnabled({ WORKFLOW_SANDBOX_ENABLED: 'true' })).toBe(true)
    })

    it('refuses to create a workflow sandbox without an explicit API URL', () => {
        expect(() => assertWorkflowSandboxConfig({ apiKey: 'k' })).toThrow(/E2B_API_URL/)
        expect(() => assertWorkflowSandboxConfig({ apiUrl: 'https://acs.example.com' })).toThrow(/E2B_API_KEY/)
    })
})
