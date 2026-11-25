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

## Run the checks

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
