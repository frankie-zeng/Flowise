import { filterConversationTurns } from './index'
import { AgentConversationTurn } from '../../database/entities/AgentConversationTurn'

const row = (overrides: Partial<AgentConversationTurn>): AgentConversationTurn =>
    ({
        id: '1',
        workspaceId: 'ws',
        chatflowId: 'flow',
        sessionId: 'chat',
        nodeId: 'node-a',
        kind: 'cao',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        ...overrides
    } as AgentConversationTurn)

describe('filterConversationTurns', () => {
    it('keeps the flow history for one workspace and node, oldest first', () => {
        const rows = [
            row({ id: 'b', nodeId: 'node-a', createdDate: new Date('2026-01-02T00:00:00Z') }),
            row({ id: 'a', nodeId: 'node-a', createdDate: new Date('2026-01-01T00:00:00Z') }),
            row({ id: 'c', nodeId: 'node-b' }),
            row({ id: 'd', workspaceId: 'other', nodeId: 'node-a' })
        ]
        const visible = filterConversationTurns(rows, { workspaceId: 'ws', chatflowId: 'flow', nodeId: 'node-a' })
        expect(visible.map((item) => item.id)).toEqual(['a', 'b'])
    })
})
