# bitlens for Bitbucket

Follow a release regression from a changed file to its earlier name, landing pull request, Git parents, and recorded branch movements. Share the investigation with both revisions fixed to commit hashes.

## Try it locally

Use Node.js 24 and npm. Run these commands from the project directory.

```sh
npm ci
npm run dev
```

Choose **Try the release example** on Home for a guided starting point with two release tags and a renamed payment configuration. Choose **Compare revisions** to open the diff and follow the file's history. For a graph of Atlassian's public [atlassian-connect-express](https://bitbucket.org/atlassian/atlassian-connect-express) repository, choose **Open graph** on the public preview. To open another public Bitbucket Cloud repository, choose **Change repository** and paste its URL or enter `workspace/repository`. Expand commits to follow their parents. Drag the background to pan or scroll over it to zoom.

The sample graph starts from a dated snapshot of public Bitbucket REST records. Other repositories and uncached records use the public API and need network access. For a private repository, install bitlens in the workspace and choose **Apps → bitlens** from the repository in Bitbucket. The Forge app reads that repository with the current viewer's permissions. Replay records live events in the installed app. In the public preview, open **Replay → Open Replay example** to explore a sample force-push and branch deletion. See the [judge walkthrough](JUDGE.md) for hosted installation.

## Use bitlens in a Linux or WSL terminal

Install Node.js 24 in that environment and run `npm ci` from this checkout.

```sh
npm run bitlens -- --help
npm run bitlens -- graph --repo atlassian/atlassian-connect-express
npm run bitlens -- compare v12.2.1 v12.2.3 --repo atlassian/atlassian-connect-express
npm run --silent bitlens -- tree master --repo atlassian/atlassian-connect-express --json
```

Use `--repo` from any directory when calling the script directly with `tsx` from this checkout. If omitted, the CLI looks for the Bitbucket `origin` of the current directory, or the directory npm was invoked from. For authenticated requests, set `BITBUCKET_TOKEN` to a read-scoped Bitbucket bearer token. Commands are read only and return the first page. View recorded Replay events in the installed Forge app.

## Graph workflows

Select a graph commit and open **Commit workbench** below the map.

- **Review** loads related PRs, opens exact revisions in Compare, and submits comments, approvals, or requests for changes after confirmation. Mark a revision reviewed locally to compare later changes against that browser bookmark. Fork PR comparisons open in Bitbucket.
- **Pipelines** shows runs for the selected commit. Start the default pipeline or enter a custom pipeline name from that revision's `bitbucket-pipelines.yml`. Stop active runs, or open Bitbucket for logs and deployment controls. A custom workflow can run a coding agent already configured by the repository. BitLens does not provision agents or manage their credentials.
- **Agent handoff** prepares a Markdown brief or JSON snapshot with a task, full commit hashes, changed paths, and an investigation link. It explicitly labels partial file lists. No file contents or credentials are exported. Share repository metadata only with agents you trust.

The public preview supports handoff export but does not simulate live PRs or pipeline writes. Hosted operations use `asUser()` and require repository access. Deploy the updated manifest and upgrade the installation to grant `write:pullrequest:bitbucket`, `read:pipeline:bitbucket`, and `write:pipeline:bitbucket` before using these features. Review heads are checked immediately before writing, but Bitbucket does not provide an atomic revision-conditioned review operation here. A concurrent push after that check remains possible. Inspect the PR after reviewing. An unknown write outcome is never automatically retried; check Bitbucket before acknowledging and trying again.

### Local MCP connection

Download a context JSON file from Agent handoff. In an MCP client's stdio server settings, configure `node` with two arguments: the absolute path to this checkout's `scripts/agent-mcp.mjs`, and the absolute path to the downloaded JSON. Paths are passed as arguments, not shell commands. No installation or token is needed for this adapter.

```json
{
  "mcpServers": {
    "bitlens": {
      "command": "node",
      "args": ["/absolute/path/to/bitlens/scripts/agent-mcp.mjs", "/absolute/path/to/bitlens-context.json"]
    }
  }
}
```

The adapter implements the MCP 2025-11-25 stdio handshake (also negotiates earlier supported revisions). `bitlens_context` reads the task and pinned revision. `bitlens_changes` reads exported changed paths and their completeness flag. Both tools are read-only. This is an exported snapshot, with no live repository connection, arbitrary file access, shell execution, or agent lifecycle controls. Restart the adapter with a fresh export to change context. Client-specific configuration formats may differ.

## Configure the help provider

Open **Help** or the chat bubble to ask about BitLens. The side panel sends the model a product guide, the current view name, and up to four earlier model replies with their questions. Answers from the built-in guide are labeled separately.

To use OpenAI in local development or the local preview, set `BITLENS_OPENAI_API_KEY` in the server environment or in the project's ignored `.env.local`, then restart the server. The default model is `gpt-4.1-mini`. Set `BITLENS_OPENAI_MODEL` to override it. The key stays on the server. Never give it a `VITE_` prefix. Static previews without this server use the built-in guide.

For Forge, set the key as an encrypted variable in the target environment using `forge variables set --encrypt BITLENS_OPENAI_API_KEY`, then deploy. Upgrade existing installations to grant the new OpenAI egress permission. Without an explicit provider, the installed app uses the Forge LLM module.

Deploy the `llm` module with the app. For existing installations, an administrator must approve the updated major version. [Forge LLM module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/llm/)

To use a custom provider with Forge, leave `BITLENS_OPENAI_API_KEY` unset, allow the provider's HTTPS origin in the manifest's backend fetch permissions, and set `BITLENS_HELP_URL`. If it requires authentication, set `BITLENS_HELP_TOKEN` as an encrypted environment variable. The endpoint accepts a JSON POST with `{ "system": "...", "question": "...", "history": [] }` and returns `{ "answer": "..." }`.

## Build and test

```sh
npm test
npm run build
npm run check:manifest
npm run test:browser
```

The browser suite uses an installed copy of Chrome on Windows or Playwright Chromium. Run `npx playwright install chromium` if the browser is missing. To serve the built example, run `npm run build:example` followed by `npm run preview:example`.
If port 4174 is already in use, set `BITLENS_TEST_PORT` to a free port before running the browser suite.

## How the app fits together

- **Forge entry point.** The Bitbucket repository Apps menu opens a React Custom UI resource. The resolver checks repository access before serving a query or reading stored events.
- **Release investigation.** The client resolves a comparison to two hashes, groups changes by directory, follows file history across renames, and draws parent edges with Cytoscape. Opening a source record takes the viewer to its evidence.
- **Replay.** Forge KVS stores initial branch and tag observations and subsequent push events. The app compares recorded pointers with current refs and surfaces partial coverage and discontinuities. Git ancestry is available for revisions that predate recording.
- **Repository access.** Shared links identify the repository page, hashes, path, and selected records. Opening one invokes the same resolver and repository access check as starting a new investigation.

See the [architecture](ARCHITECTURE.md) for service boundaries and the [engineering handoff](repository-history-handoff.md) for Codegeist scope and submission requirements.
