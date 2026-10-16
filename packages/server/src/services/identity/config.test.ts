import { casdoorAuthorizeUrl, casdoorProfileEmail, getCasdoorConfig, isAuthBypassEnabled, publicAuthConfig } from './config'

describe('identity config', () => {
    it('enables auth bypass only for AUTH_BYPASS=1', () => {
        expect(isAuthBypassEnabled({})).toBe(false)
        expect(isAuthBypassEnabled({ AUTH_BYPASS: '1' })).toBe(true)
        expect(isAuthBypassEnabled({ AUTH_BYPASS: 'true' })).toBe(true)
    })

    it('requires the casdoor endpoint, client id, and secret together', () => {
        expect(getCasdoorConfig({ CASDOOR_ENDPOINT: 'https://door.example.com' })).toBeUndefined()
        const config = getCasdoorConfig({
            CASDOOR_ENDPOINT: 'https://door.example.com/',
            CASDOOR_CLIENT_ID: 'client',
            CASDOOR_CLIENT_SECRET: 'secret',
            APP_URL: 'http://localhost:3000'
        })
        expect(config?.endpoint).toBe('https://door.example.com')
        expect(config?.redirectUri).toBe('http://localhost:3000/api/v1/casdoor/callback')
        expect(
            JSON.stringify(
                publicAuthConfig({ CASDOOR_ENDPOINT: 'https://door.example.com', CASDOOR_CLIENT_ID: 'c', CASDOOR_CLIENT_SECRET: 's' })
            )
        ).not.toContain('secret')
    })

    it('builds the authorize URL from the configured endpoint', () => {
        const config = getCasdoorConfig({
            CASDOOR_ENDPOINT: 'https://door.whyengineer.com',
            CASDOOR_CLIENT_ID: 'flowise',
            CASDOOR_CLIENT_SECRET: 'secret',
            CASDOOR_REDIRECT_URI: 'http://localhost:3000/api/v1/casdoor/callback'
        })!
        const url = new URL(casdoorAuthorizeUrl(config, 'state-1'))
        expect(url.origin).toBe('https://door.whyengineer.com')
        expect(url.pathname).toBe('/login/oauth/authorize')
        expect(url.searchParams.get('client_id')).toBe('flowise')
        expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/v1/casdoor/callback')
        expect(url.searchParams.get('client_secret')).toBeNull()
    })

    it('maps a casdoor profile to an email', () => {
        expect(casdoorProfileEmail({ email: 'Ada@Example.com' })).toBe('ada@example.com')
        expect(casdoorProfileEmail({ sub: 'user/42' })).toBe('user42@users.casdoor.local')
    })
})
