# Agentflow extensions

These additions sit on Agentflow V2 and stay off until the matching environment variables are set. The product UI is Agentflow V2. The Chatflow builder, Agentflow V1, and Assistants are not in the sidebar or routes, and the API rejects new rows of type `CHATFLOW` or `MULTIAGENT`. Agentflows stay in the shared `chat_flow` table with type `AGENTFLOW`. Existing agentflows and logins behave as before when the variables are unset.

The private prototype at `frankie-zeng/agent-workflow` was not readable from this environment. The behavior below follows that brief and Flowise's own execution, storage, and workspace model.

## Local development

```bash
pnpm install
pnpm build
```

Create `packages/server/.env` (this file is gitignored):

```bash
APP_URL=http://localhost:3000
AUTH_BYPASS=1
STORAGE_TYPE=local
# Optional, once an ACS endpoint is available:
# WORKFLOW_SANDBOX_ENABLED=1
# E2B_API_URL=https://your-acs-endpoint.example.com
# E2B_DOMAIN=your-acs-endpoint.example.com
# E2B_API_KEY=
# E2B_TEMPLATE=
# EXECUTION_ARTIFACTS_ENABLED=1
```

Start the API and the UI in two terminals:

```bash
pnpm start
pnpm --filter flowise-ui dev
```

Open http://localhost:3000. With `AUTH_BYPASS=1` the sign-in page creates `dev@localhost.local`, gives that user a workspace, and enters the app. Do not set `AUTH_BYPASS` on a shared or production host.

`pnpm build` from the repository root builds every package. `pnpm test` runs the package test suites.

## Per-workflow sandbox

| Variable                   | Purpose                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `WORKFLOW_SANDBOX_ENABLED` | `1` turns the feature on                                                           |
| `E2B_API_URL`              | ACS / E2B-compatible API. Required. The server does not fall back to `api.e2b.dev` |
| `E2B_DOMAIN`               | Sandbox domain, when the provider uses one                                         |
| `E2B_API_KEY`              | API key. `E2B_APIKEY` is also accepted                                             |
| `E2B_TEMPLATE`             | Sandbox template. `SANDBOX_TEMPLATE` is also accepted                              |
| `E2B_SANDBOX_TIMEOUT_MS`   | Lifetime extended on each run. `SANDBOX_TIMEOUT` is also accepted                  |

One sandbox is stored per chatflow id in `workflow_sandbox`. It is created on the first execution of that flow, not when the flow is created or edited. Later runs reconnect to the same sandbox. A finished, failed, or paused run does not kill it.

The canvas button **释放沙箱** calls `POST /api/v1/chatflows/:id/sandbox/release`. Deleting the flow kills the sandbox and deletes the row. `GET /api/v1/chatflows/:id/sandbox` only reports status.

While a run is inside this sandbox, custom-function JavaScript and the E2B code-interpreter tool use that sandbox instead of a new one. The legacy `E2B_APIKEY` path, used when this flag is off, still creates an ephemeral sandbox and kills it after the script.

## Casdoor SSO

| Variable                | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `CASDOOR_ENDPOINT`      | For example `https://door.example.com`           |
| `CASDOOR_CLIENT_ID`     | OIDC client id                                   |
| `CASDOOR_CLIENT_SECRET` | OIDC client secret                               |
| `CASDOOR_REDIRECT_URI`  | Defaults to `${APP_URL}/api/v1/casdoor/callback` |
| `APP_URL`               | Public URL of this Flowise server                |

Register that redirect URI on the Casdoor application. The login button on `/signin` sends the browser to `/api/v1/casdoor/login`.

The first successful login creates the default organization and a workspace named for that user. Later users join the same organization and receive their own workspace, with the personal-workspace role. Flows, executions, and stored files stay on `workspaceId`, so each user sees their own workspace. An email that already belongs to a password user is linked to Casdoor on first SSO login. A user already linked to a different subject is rejected.

Cloud mode does not create users that are not already in the database.

## Execution artifacts

Set `EXECUTION_ARTIFACTS_ENABLED=1`. After each Agentflow node, the input and output JSON are written through the existing storage provider (`STORAGE_TYPE` = `local`, `s3`, `gcs`, or `azure`; S3-compatible endpoints use `S3_ENDPOINT_URL`). A2A nodes also store `a2a-request.json` and `a2a-response.json`. CAO nodes store `cao-request.json` and `cao-response.json`. Files returned as `output.files = [{ name, mimeType, content }]` are stored too.

Rows live in `execution_artifact`. The execution detail panel lists them under **Artifacts / 产物** and loads the body from `GET /api/v1/executions/:id/artifacts/:artifactId`.

`EXECUTION_ARTIFACT_MAX_BYTES` defaults to 2000000.

## Human input

The Human Input node has a **Mode** field:

-   **Approve / 审批** — the original Proceed and Reject pause.
-   **Input / 输入** — pause for free text, then continue on the Proceed output.
-   **Output / 输出** — show the description and wait for acknowledgement.

Flows saved before this field keep approve/reject.

Critic, debate, best-of-N, and reflexion are composed with the built-in LLM, Agent, Condition, Loop, and Iteration nodes. There is no separate Pattern node.

## A2A node

The **A2A** node POSTs JSON-RPC `message/send` to the agent URL. `contextId` and `taskId` are saved in `a2a_session` for the chatflow, session, and node, and also copied into flow state under `a2a.<nodeId>`. The request and response are on the node output and, when artifacts are enabled, in storage. Each call is also written to the conversation log below. The bearer token stays on the HTTP header and is not part of the recorded request.

## CAO node

The **CAO** node calls a running [CLI Agent Orchestrator](https://github.com/awslabs/cli-agent-orchestrator) server (`cao-server`, default `http://127.0.0.1:9889`). It creates or reuses a session, then hands a task to an agent profile.

CAO is not started inside the per-workflow sandbox. A session needs tmux, the provider CLIs, and a process that outlives a single node run. To isolate it, run `cao-server` in that environment and point this node at it.

Server URL order is the node **Server URL**, then the optional **CAO Server** credential (`caoApi`), then `CAO_SERVER_URL`. Bearer token order is the node field, the credential, then `CAO_BEARER_TOKEN`. The token is not stored on the conversation row. `env_vars` are sent on session create and recorded as `[redacted]`.

The session row in `cao_session` is unique per chatflow and node. Later runs of the same flow reuse that session name and, when **Reuse Terminal** is on, the saved terminal id. An explicit **Session Name** replaces the saved name. A workspace mismatch ignores the row.

The panel leads with **Provider**, **Agent Profile**, **Mode**, and **Task**. The rest sit under **Additional Parameters**.

| Field                   | Default                                               | CAO surface                                                                      |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Provider                | `claude_code`                                         | `provider` on session, terminal, and `run-step`                                  |
| Agent Profile           | `developer` or `CAO_AGENT_PROFILE`                    | `agent_profile` / `agent`                                                        |
| Mode                    | `handoff`                                             | `handoff`, `assign`, or `send_message`                                           |
| Task                    | incoming input when empty                             | prompt / message                                                                 |
| Server URL              | credential, then `CAO_SERVER_URL`                     | base URL                                                                         |
| Bearer Token            | credential, then `CAO_BEARER_TOKEN`                   | `Authorization` header                                                           |
| Session Name            | saved name, else a stable name for this flow and node | `session_name`                                                                   |
| Reuse Terminal          | on                                                    | `reuse_terminal_id`; a 404 retries without it                                    |
| Tear Down After Handoff | off, shown for handoff                                | `teardown` on `POST /terminals/run-step`                                         |
| Timeout (seconds)       | `600` or `CAO_TIMEOUT_SECONDS`                        | `timeout`; HTTP client adds 30 seconds                                           |
| Wait Behavior           | follow mode                                           | handoff waits; assign and send_message return `accepted` unless set to wait      |
| Poll Interval (seconds) | `2`                                                   | `GET /terminals/{id}` until `completed` or `error`, then `GET /output?mode=full` |
| Working Directory       | empty                                                 | `working_directory`                                                              |
| Caller Terminal Id      | empty                                                 | `caller_id`                                                                      |
| Receiver Terminal Id    | saved terminal, send_message only                     | inbox `POST /terminals/{id}/inbox/messages`                                      |
| Allowed Tools           | empty                                                 | comma list; array on `run-step`                                                  |
| Use Git Worktree        | off                                                   | `use_worktree`                                                                   |
| Memory Manager Sidecar  | off                                                   | `memory_manager=true` on session create                                          |
| Env Vars (JSON)         | empty                                                 | body `env_vars`                                                                  |
| Claim Id                | empty                                                 | 32 lowercase hex `claim_id`; omitted when a terminal is reused                   |
| Group (JSON)            | empty                                                 | session create body                                                              |
| Metadata (JSON)         | empty                                                 | session create body                                                              |
| Shape Provider Prompt   | on                                                    | Codex tasks are prefixed with `CAO_TERMINAL_ID=`                                 |
| Inject Sender Id        | off                                                   | appends `(sender: <caller id>)` when a caller id is set                          |
| Job Id                  | empty                                                 | 32 lowercase hex `job_id` on `run-step` for `GET /handoff-results/{job_id}`      |

Providers: `claude_code`, `codex`, `cursor_cli`, `q_cli`, `kiro_cli`, `copilot_cli`, `opencode_cli`, `kimi_cli`, `hermes`, `antigravity_cli`. A cao-server build that does not ship a binary will reject that provider at launch.

**Handoff** with wait posts `POST /terminals/run-step` after `POST /sessions` (201, 200, or 409). **Assign** and handoff set to return create a terminal when needed and post `POST /terminals/{id}/input`. **Send Message** posts the inbox route. Wait behavior **Wait until completed** polls outside `run-step`.

Profile install, the memory graph, the workflow engine, and the PTY websocket are cao-server admin APIs. They are not fields on this node.

## Conversation history

A2A and CAO turns are stored in `agent_conversation_turn` for the workspace, chatflow, and node. A turn keeps status, the user message, the agent text, `contextId`/`taskId` or the CAO session and terminal id, timestamps, and the raw request and response. Rows are kept across runs of the flow and are not gated on `EXECUTION_ARTIFACTS_ENABLED`. Deleting the flow deletes them.

The execution detail panel shows **Conversation / 对话** for those nodes: each turn, the ids, status, time, a raw JSON toggle, and the stored artifacts section underneath. History is loaded from `GET /api/v1/executions/:id/conversations?nodeId=`. The node output also carries `turns` so the panel can render the current call when that request is unavailable.

## What is not automatic

-   Sandboxes are not created for flows that have never been run.
-   `AUTH_BYPASS` and Casdoor do not disable API keys on prediction routes that were already public.
