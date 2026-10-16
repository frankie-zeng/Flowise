import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCaoConversations1782000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`cao_session\` (
                \`id\` varchar(36) NOT NULL,
                \`chatflowId\` varchar(36) NOT NULL,
                \`nodeId\` varchar(255) NOT NULL,
                \`caoSessionName\` varchar(64) NOT NULL,
                \`terminalId\` varchar(64) NULL,
                \`provider\` varchar(64) NULL,
                \`agentProfile\` varchar(255) NULL,
                \`workspaceId\` text NULL,
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_cao_session_key\` (\`chatflowId\`, \`nodeId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`agent_conversation_turn\` (
                \`id\` varchar(36) NOT NULL,
                \`workspaceId\` text NOT NULL,
                \`chatflowId\` varchar(36) NOT NULL,
                \`sessionId\` varchar(255) NOT NULL,
                \`executionId\` varchar(36) NULL,
                \`nodeId\` varchar(255) NOT NULL,
                \`kind\` varchar(16) NOT NULL,
                \`status\` varchar(32) NULL,
                \`message\` text NULL,
                \`output\` text NULL,
                \`externalSession\` text NULL,
                \`externalTask\` text NULL,
                \`rawRequest\` text NULL,
                \`rawResponse\` text NULL,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_agent_conversation_lookup\` (\`chatflowId\`, \`nodeId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`agent_conversation_turn\`;`)
        await queryRunner.query(`DROP TABLE IF EXISTS \`cao_session\`;`)
    }
}
