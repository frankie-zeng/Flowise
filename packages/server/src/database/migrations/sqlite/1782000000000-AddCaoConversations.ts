import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCaoConversations1782000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "cao_session" ("id" varchar PRIMARY KEY NOT NULL, "chatflowId" varchar NOT NULL, "nodeId" varchar NOT NULL, "caoSessionName" varchar NOT NULL, "terminalId" varchar, "provider" varchar, "agentProfile" varchar, "workspaceId" text, "updatedDate" datetime NOT NULL DEFAULT (datetime('now')));`
        )
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cao_session_key" ON "cao_session" ("chatflowId", "nodeId");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "agent_conversation_turn" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" text NOT NULL, "chatflowId" varchar NOT NULL, "sessionId" varchar NOT NULL, "executionId" varchar, "nodeId" varchar NOT NULL, "kind" varchar NOT NULL, "status" varchar, "message" text, "output" text, "externalSession" text, "externalTask" text, "rawRequest" text, "rawResponse" text, "createdDate" datetime NOT NULL DEFAULT (datetime('now')));`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_lookup" ON "agent_conversation_turn" ("chatflowId", "nodeId");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "agent_conversation_turn";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "cao_session";`)
    }
}
