import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('cao_session')
@Index('IDX_cao_session_key', ['chatflowId', 'nodeId'], { unique: true })
export class CaoSession {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 36 })
    chatflowId: string

    @Column({ type: 'varchar', length: 255 })
    nodeId: string

    @Column({ type: 'varchar', length: 64 })
    caoSessionName: string

    @Column({ type: 'varchar', length: 64, nullable: true })
    terminalId?: string

    @Column({ type: 'varchar', length: 64, nullable: true })
    provider?: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    agentProfile?: string

    @Column({ type: 'text', nullable: true })
    workspaceId?: string

    @UpdateDateColumn()
    updatedDate: Date
}
