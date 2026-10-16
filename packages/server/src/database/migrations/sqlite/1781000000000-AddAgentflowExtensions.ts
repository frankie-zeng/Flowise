import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowExtensions1781000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "workflow_sandbox" ("id" varchar PRIMARY KEY NOT NULL, "chatflowId" varchar NOT NULL, "sandboxId" varchar NOT NULL, "template" varchar, "provider" varchar, "createdDate" datetime NOT NULL DEFAULT (datetime('now')), "updatedDate" datetime NOT NULL DEFAULT (datetime('now')));`
        )
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_workflow_sandbox_chatflow" ON "workflow_sandbox" ("chatflowId");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "execution_artifact" ("id" varchar PRIMARY KEY NOT NULL, "executionId" varchar NOT NULL, "agentflowId" varchar NOT NULL, "sessionId" varchar NOT NULL, "nodeId" varchar NOT NULL, "nodeLabel" varchar, "kind" varchar NOT NULL, "storagePath" text NOT NULL, "fileName" varchar NOT NULL, "mimeType" varchar, "size" integer, "workspaceId" text NOT NULL, "createdDate" datetime NOT NULL DEFAULT (datetime('now')));`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_execution_artifact_execution" ON "execution_artifact" ("executionId");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "a2a_session" ("id" varchar PRIMARY KEY NOT NULL, "chatflowId" varchar NOT NULL, "sessionId" varchar NOT NULL, "nodeId" varchar NOT NULL, "contextId" varchar, "taskId" varchar, "updatedDate" datetime NOT NULL DEFAULT (datetime('now')));`
        )
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a2a_session_key" ON "a2a_session" ("chatflowId", "sessionId", "nodeId");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "a2a_session";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "execution_artifact";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "workflow_sandbox";`)
    }
}
