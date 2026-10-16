import { assertHttpUrl, buildMessageSendRequest, parseA2AResponse } from './a2aProtocol'

describe('A2A protocol helpers', () => {
    it('omits session ids until the remote agent has assigned them', () => {
        const request = buildMessageSendRequest('hello', {}, 'msg-1')
        expect(request.method).toBe('message/send')
        expect(request.params.message.parts).toEqual([{ kind: 'text', text: 'hello' }])
        expect(request.params.message.contextId).toBeUndefined()
        expect(request.params.message.taskId).toBeUndefined()
    })

    it('keeps contextId and taskId on later messages in the session', () => {
        const request = buildMessageSendRequest('next', { contextId: 'ctx-1', taskId: 'task-1' }, 'msg-2')
        expect(request.params.message.contextId).toBe('ctx-1')
        expect(request.params.message.taskId).toBe('task-1')
    })

    it('reads text, contextId and taskId from a task result', () => {
        const parsed = parseA2AResponse({
            jsonrpc: '2.0',
            result: {
                id: 'task-9',
                contextId: 'ctx-9',
                status: { state: 'completed', message: { parts: [{ kind: 'text', text: 'done' }] } }
            }
        })
        expect(parsed.text).toBe('done')
        expect(parsed.contextId).toBe('ctx-9')
        expect(parsed.taskId).toBe('task-9')
    })

    it('rejects non-http agent URLs', () => {
        expect(() => assertHttpUrl('file:///tmp/agent')).toThrow(/http/)
        expect(assertHttpUrl('https://agent.example.com/a2a/')).toBe('https://agent.example.com/a2a')
    })
})
