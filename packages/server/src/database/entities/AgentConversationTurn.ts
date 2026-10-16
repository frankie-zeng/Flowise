import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('agent_conversation_turn')
@Index('IDX_agent_conversation_lookup', ['chatflowId', 'nodeId'])
export class AgentConversationTurn {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'text' })
    workspaceId: string

    @Column({ type: 'varchar', length: 36 })
    chatflowId: string

    @Column({ type: 'varchar', length: 255 })
    sessionId: string

    @Column({ type: 'varchar', length: 36, nullable: true })
    executionId?: string

    @Column({ type: 'varchar', length: 255 })
    nodeId: string

    @Column({ type: 'varchar', length: 16 })
    kind: string

    @Column({ type: 'varchar', length: 32, nullable: true })
    status?: string

    @Column({ type: 'text', nullable: true })
    message?: string

    @Column({ type: 'text', nullable: true })
    output?: string

    @Column({ type: 'text', nullable: true })
    externalSession?: string

    @Column({ type: 'text', nullable: true })
    externalTask?: string

    @Column({ type: 'text', nullable: true })
    rawRequest?: string

    @Column({ type: 'text', nullable: true })
    rawResponse?: string

    @CreateDateColumn()
    createdDate: Date
}
