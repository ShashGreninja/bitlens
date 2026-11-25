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

## Configure the help provider

Open Help or the bottom right avatar to ask about BitLens. The installed app uses Atlassian Forge LLMs by default. The model receives a product guide, the current view name, and up to four previous turns. The standalone preview and failed model requests use the built-in guide.

Deploy the `llm` module with the app. For existing installations, an administrator must approve the updated major version. [Forge LLM module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/llm/)

To use your own provider instead, allow its HTTPS origin in the manifest's backend fetch permissions, set `BITLENS_HELP_URL`, and optionally set `BITLENS_HELP_TOKEN` as an encrypted environment variable. The endpoint accepts a JSON POST with `{ "system": "...", "question": "...", "history": [] }` and returns `{ "answer": "..." }`. Keep provider credentials server-side.

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
