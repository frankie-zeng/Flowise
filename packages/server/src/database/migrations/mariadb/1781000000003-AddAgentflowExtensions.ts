import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowExtensions1781000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`workflow_sandbox\` (
                \`id\` varchar(36) NOT NULL,
                \`chatflowId\` varchar(36) NOT NULL,
                \`sandboxId\` varchar(255) NOT NULL,
                \`template\` varchar(255) NULL,
                \`provider\` varchar(64) NULL,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_workflow_sandbox_chatflow\` (\`chatflowId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`execution_artifact\` (
                \`id\` varchar(36) NOT NULL,
                \`executionId\` varchar(36) NOT NULL,
                \`agentflowId\` varchar(36) NOT NULL,
                \`sessionId\` varchar(255) NOT NULL,
                \`nodeId\` varchar(255) NOT NULL,
                \`nodeLabel\` varchar(255) NULL,
                \`kind\` varchar(64) NOT NULL,
                \`storagePath\` text NOT NULL,
                \`fileName\` varchar(255) NOT NULL,
                \`mimeType\` varchar(128) NULL,
                \`size\` int NULL,
                \`workspaceId\` text NOT NULL,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_execution_artifact_execution\` (\`executionId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`a2a_session\` (
                \`id\` varchar(36) NOT NULL,
                \`chatflowId\` varchar(36) NOT NULL,
                \`sessionId\` varchar(255) NOT NULL,
                \`nodeId\` varchar(255) NOT NULL,
                \`contextId\` varchar(255) NULL,
                \`taskId\` varchar(255) NULL,
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_a2a_session_key\` (\`chatflowId\`, \`sessionId\`, \`nodeId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS `a2a_session`;')
        await queryRunner.query('DROP TABLE IF EXISTS `execution_artifact`;')
        await queryRunner.query('DROP TABLE IF EXISTS `workflow_sandbox`;')
    }
}
