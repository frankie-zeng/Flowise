import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowExtensions1781000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "workflow_sandbox" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "chatflowId" varchar NOT NULL,
                "sandboxId" varchar NOT NULL,
                "template" varchar,
                "provider" varchar,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_workflow_sandbox" PRIMARY KEY ("id")
            );`
        )
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_workflow_sandbox_chatflow" ON "workflow_sandbox" ("chatflowId");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "execution_artifact" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "executionId" varchar NOT NULL,
                "agentflowId" varchar NOT NULL,
                "sessionId" varchar NOT NULL,
                "nodeId" varchar NOT NULL,
                "nodeLabel" varchar,
                "kind" varchar NOT NULL,
                "storagePath" text NOT NULL,
                "fileName" varchar NOT NULL,
                "mimeType" varchar,
                "size" integer,
                "workspaceId" text NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_execution_artifact" PRIMARY KEY ("id")
            );`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_execution_artifact_execution" ON "execution_artifact" ("executionId");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "a2a_session" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "chatflowId" varchar NOT NULL,
                "sessionId" varchar NOT NULL,
                "nodeId" varchar NOT NULL,
                "contextId" varchar,
                "taskId" varchar,
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a2a_session" PRIMARY KEY ("id")
            );`
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
