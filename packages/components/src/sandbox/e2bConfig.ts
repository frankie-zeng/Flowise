/**
 * E2B-compatible connection settings for Aliyun ACS Agent Sandbox and other
 * E2B-compatible endpoints. Values come only from the environment. This module
 * never falls back to api.e2b.dev; when a URL is unset the SDK is not given one.
 */

export interface E2BConnectionConfig {
    apiKey?: string
    apiUrl?: string
    domain?: string
    template?: string
    timeoutMs?: number
    metadata?: Record<string, string>
}

const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'YES'])

export const isWorkflowSandboxEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
    return TRUE_VALUES.has(env.WORKFLOW_SANDBOX_ENABLED || '')
}

export const isExecutionArtifactsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
    return TRUE_VALUES.has(env.EXECUTION_ARTIFACTS_ENABLED || '')
}

/** Prefer E2B_API_KEY. E2B_APIKEY remains accepted for the existing ephemeral path. */
export const getE2BApiKey = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
    const key = env.E2B_API_KEY || env.E2B_APIKEY
    return key && key.trim() ? key.trim() : undefined
}

export const getE2BConnectionConfig = (env: NodeJS.ProcessEnv = process.env): E2BConnectionConfig => {
    const apiUrl = env.E2B_API_URL?.trim()
    const domain = env.E2B_DOMAIN?.trim()
    const template = (env.E2B_TEMPLATE || env.SANDBOX_TEMPLATE)?.trim()
    const timeoutRaw = env.E2B_SANDBOX_TIMEOUT_MS || env.SANDBOX_TIMEOUT
    const timeoutMs = timeoutRaw ? parseInt(timeoutRaw, 10) : undefined

    const config: E2BConnectionConfig = {}
    const apiKey = getE2BApiKey(env)
    if (apiKey) config.apiKey = apiKey
    if (apiUrl) config.apiUrl = apiUrl
    if (domain) config.domain = domain
    if (template) config.template = template
    if (timeoutMs && !Number.isNaN(timeoutMs)) config.timeoutMs = timeoutMs
    return config
}

/**
 * Options object passed to Sandbox.create/connect. Undefined fields are omitted
 * so the SDK is not pointed at a hard-coded public host.
 */
export const toE2BCreateOptions = (config: E2BConnectionConfig): Record<string, unknown> => {
    const opts: Record<string, unknown> = {}
    if (config.apiKey) opts.apiKey = config.apiKey
    if (config.apiUrl) opts.apiUrl = config.apiUrl
    if (config.domain) opts.domain = config.domain
    if (config.timeoutMs) opts.timeoutMs = config.timeoutMs
    if (config.metadata) opts.metadata = config.metadata
    return opts
}

export const assertWorkflowSandboxConfig = (config: E2BConnectionConfig): void => {
    if (!config.apiKey) {
        throw new Error('WORKFLOW_SANDBOX_ENABLED requires E2B_API_KEY (or E2B_APIKEY)')
    }
    if (!config.apiUrl) {
        throw new Error('WORKFLOW_SANDBOX_ENABLED requires E2B_API_URL. Refusing to default to api.e2b.dev')
    }
}
