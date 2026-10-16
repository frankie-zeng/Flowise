# Agentflow extensions

These additions sit on Agentflow V2 and stay off until the matching environment variables are set. Existing chatflows, agentflows, and logins behave as before when the variables are unset.

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

Set `EXECUTION_ARTIFACTS_ENABLED=1`. After each Agentflow node, the input and output JSON are written through the existing storage provider (`STORAGE_TYPE` = `local`, `s3`, `gcs`, or `azure`; S3-compatible endpoints use `S3_ENDPOINT_URL`). A2A nodes also store `a2a-request.json` and `a2a-response.json`. Files returned as `output.files = [{ name, mimeType, content }]` are stored too.

Rows live in `execution_artifact`. The execution detail panel lists them under **Artifacts / 产物** and loads the body from `GET /api/v1/executions/:id/artifacts/:artifactId`.

`EXECUTION_ARTIFACT_MAX_BYTES` defaults to 2000000.

## Human input

The Human Input node has a **Mode** field:

-   **Approve / 审批** — the original Proceed and Reject pause.
-   **Input / 输入** — pause for free text, then continue on the Proceed output.
-   **Output / 输出** — show the description and wait for acknowledgement.

Flows saved before this field keep approve/reject.

## A2A node

The **A2A** node POSTs JSON-RPC `message/send` to the agent URL. `contextId` and `taskId` are saved in `a2a_session` for the chatflow, session, and node, and also copied into flow state under `a2a.<nodeId>`. The request and response are on the node output and, when artifacts are enabled, in storage.

## Pattern node

The **Pattern** node runs one chat model through critic, debate, best of N, or reflexion. The transcript is on the node output. This is a single-model implementation of those patterns, not a separate agent for each role.

## What is not automatic

-   Sandboxes are not created for flows that have never been run.
-   `AUTH_BYPASS` and Casdoor do not disable API keys on prediction routes that were already public.
-   Pattern steps are sequential calls to the selected chat model. They do not spawn extra sandboxes.
