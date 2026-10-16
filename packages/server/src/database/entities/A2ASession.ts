import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('a2a_session')
@Index('IDX_a2a_session_key', ['chatflowId', 'sessionId', 'nodeId'], { unique: true })
export class A2ASession {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 36 })
    chatflowId: string

    @Column({ type: 'varchar', length: 255 })
    sessionId: string

    @Column({ type: 'varchar', length: 255 })
    nodeId: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    contextId?: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    taskId?: string

    @UpdateDateColumn()
    updatedDate: Date
}
