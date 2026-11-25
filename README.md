# bitlens for Bitbucket

Follow a release regression from a changed file to its earlier name, landing pull request, Git parents, and recorded branch movements. Share the investigation with both revisions fixed to commit hashes.

## Try it locally

Use Node.js 24 and npm. Run these commands from the project directory.

```sh
npm ci
npm run dev
```

Choose **Open graph** on Home to explore Atlassian's public [atlassian-connect-express](https://bitbucket.org/atlassian/atlassian-connect-express) repository. To open another public Bitbucket Cloud repository, choose **Change repository** and paste its URL or enter `workspace/repository`. Choose a branch or tag, then expand commits to follow their parents. Drag the background to pan or scroll over it to zoom.

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

Help ships with a built-in guide. The public preview uses that guide. The Forge app uses it when a provider is unavailable or unconfigured.

To enable a provider in Forge, allow its HTTPS origin in the manifest's backend fetch permissions. Set `BITLENS_HELP_URL` in the selected Forge environment and optionally set `BITLENS_HELP_TOKEN` as an encrypted environment variable. Deploy the updated manifest. The endpoint accepts a JSON POST with `{ "system": "...", "question": "..." }` and returns `{ "answer": "..." }`. The [system prompt](shared/help.ts) is sent from the resolver. The request contains the current question and product guide. Keep provider credentials server-side.

## Build and test

```sh
npm test
npm run build
npm run check:manifest
npm run test:browser
```

The browser suite uses an installed copy of Chrome on Windows or Playwright Chromium. Run `npx playwright install chromium` if the browser is missing. To serve the built example, run `npm run build:example` followed by `npm run preview:example`.

## How the app fits together

- **Forge entry point.** The Bitbucket repository Apps menu opens a React Custom UI resource. The resolver checks repository access before serving a query or reading stored events.
- **Release investigation.** The client resolves a comparison to two hashes, groups changes by directory, follows file history across renames, and draws parent edges with Cytoscape. Opening a source record takes the viewer to its evidence.
- **Replay.** Forge KVS stores initial branch and tag observations and subsequent push events. The app compares recorded pointers with current refs and surfaces partial coverage and discontinuities. Git ancestry is available for revisions that predate recording.
- **Repository access.** Shared links identify the repository page, hashes, path, and selected records. Opening one invokes the same resolver and repository access check as starting a new investigation.

See the [architecture](ARCHITECTURE.md) for service boundaries and the [engineering handoff](repository-history-handoff.md) for Codegeist scope and submission requirements.
