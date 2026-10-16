import { AsyncLocalStorage } from 'async_hooks'

/**
 * Per-run handle for the workflow sandbox. Nodes and code execution read this
 * from async context so tool calls stay on the same sandbox without a new
 * parameter on every LangChain tool.
 */
export interface WorkflowSandboxContext {
    mode: 'ready' | 'unavailable'
    chatflowId: string
    sandboxId?: string
    /** Live E2B Sandbox. Typed as any so callers can use the SDK instance without a second copy of its class. */
    sandbox?: any
    error?: string
}

const storage = new AsyncLocalStorage<WorkflowSandboxContext>()

export const getWorkflowSandboxContext = (): WorkflowSandboxContext | undefined => storage.getStore()

export const runWithWorkflowSandbox = <T>(context: WorkflowSandboxContext, fn: () => Promise<T>): Promise<T> => {
    return storage.run(context, fn)
}
