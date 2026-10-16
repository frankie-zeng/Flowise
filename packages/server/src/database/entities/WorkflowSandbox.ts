import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('workflow_sandbox')
export class WorkflowSandbox {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index('IDX_workflow_sandbox_chatflow', { unique: true })
    @Column({ type: 'varchar', length: 36 })
    chatflowId: string

    @Column({ type: 'varchar', length: 255 })
    sandboxId: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    template?: string

    @Column({ type: 'varchar', length: 64, nullable: true })
    provider?: string

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date
}
