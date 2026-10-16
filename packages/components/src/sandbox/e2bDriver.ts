import { E2BConnectionConfig, toE2BCreateOptions } from './e2bConfig'

export interface E2BSandboxHandle {
    sandboxId: string
    sandbox: any
}

const loadSandbox = async () => {
    const mod = await import('@e2b/code-interpreter')
    return mod.Sandbox
}

export const createE2BSandbox = async (config: E2BConnectionConfig): Promise<E2BSandboxHandle> => {
    const Sandbox = await loadSandbox()
    const opts = toE2BCreateOptions(config)
    const sbx = config.template ? await Sandbox.create(config.template, opts) : await Sandbox.create(opts)
    const sandboxId = sbx.sandboxId as string
    if (!sandboxId) {
        throw new Error('E2B-compatible sandbox did not return a sandboxId')
    }
    return { sandboxId, sandbox: sbx }
}

export const connectE2BSandbox = async (sandboxId: string, config: E2BConnectionConfig): Promise<any> => {
    const Sandbox = await loadSandbox()
    return Sandbox.connect(sandboxId, toE2BCreateOptions(config))
}

export const killE2BSandbox = async (sandbox: { kill?: () => Promise<void> } | undefined): Promise<void> => {
    if (sandbox && typeof sandbox.kill === 'function') {
        await sandbox.kill()
    }
}

export const extendE2BSandbox = async (
    sandbox: { setTimeout?: (timeoutMs: number) => Promise<void> },
    timeoutMs: number
): Promise<void> => {
    if (sandbox && typeof sandbox.setTimeout === 'function') {
        await sandbox.setTimeout(timeoutMs)
    }
}
