const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'YES'])

export interface CasdoorConfig {
    endpoint: string
    clientId: string
    clientSecret: string
    redirectUri: string
}

export const isAuthBypassEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => TRUE_VALUES.has(env.AUTH_BYPASS || '')

export const getCasdoorConfig = (env: NodeJS.ProcessEnv = process.env): CasdoorConfig | undefined => {
    const endpoint = env.CASDOOR_ENDPOINT?.trim().replace(/\/$/, '')
    const clientId = env.CASDOOR_CLIENT_ID?.trim()
    const clientSecret = env.CASDOOR_CLIENT_SECRET?.trim()
    if (!endpoint || !clientId || !clientSecret) return undefined
    const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = env.CASDOOR_REDIRECT_URI?.trim() || `${appUrl}/api/v1/casdoor/callback`
    return { endpoint, clientId, clientSecret, redirectUri }
}

export const isCasdoorEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => Boolean(getCasdoorConfig(env))

export const casdoorAuthorizeUrl = (config: CasdoorConfig, state: string): string => {
    const url = new URL(`${config.endpoint}/login/oauth/authorize`)
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('scope', 'openid profile email')
    url.searchParams.set('state', state)
    return url.toString()
}

/** Public auth flags for the login page. Secrets are never included. */
export const publicAuthConfig = (env: NodeJS.ProcessEnv = process.env) => ({
    authBypass: isAuthBypassEnabled(env),
    casdoor: isCasdoorEnabled(env)
})

export const syntheticCasdoorEmail = (subject: string): string => {
    const safe = subject.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || 'user'
    return `${safe}@users.casdoor.local`
}

export const casdoorProfileEmail = (profile: { email?: string; sub?: string; id?: string; name?: string }): string | undefined => {
    if (profile.email && profile.email.includes('@')) return profile.email.toLowerCase()
    const subject = profile.sub || profile.id
    if (!subject) return undefined
    return syntheticCasdoorEmail(String(subject))
}
