import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('execution_artifact')
export class ExecutionArtifact {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column({ type: 'varchar', length: 36 })
    executionId: string

    @Index()
    @Column({ type: 'varchar', length: 36 })
    agentflowId: string

    @Column({ type: 'varchar', length: 255 })
    sessionId: string

    @Column({ type: 'varchar', length: 255 })
    nodeId: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    nodeLabel?: string

    @Column({ type: 'varchar', length: 64 })
    kind: string

    @Column({ type: 'text' })
    storagePath: string

    @Column({ type: 'varchar', length: 255 })
    fileName: string

    @Column({ type: 'varchar', length: 128, nullable: true })
    mimeType?: string

    @Column({ type: 'int', nullable: true })
    size?: number

    @Column({ type: 'text' })
    workspaceId: string

    @CreateDateColumn()
    createdDate: Date
}
