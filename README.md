# Repository History for Bitbucket

Follow a release regression from a changed file to its earlier name, landing pull request, Git parents, and recorded branch movements. Share the investigation with both revisions fixed to commit hashes.

## Try it locally

Use Node.js 24 and npm. Run these commands from the project directory.

```sh
npm ci
npm run dev
```

Open the local URL in the terminal. The example starts at `v1.4` → `v1.5` in the payments service. The selected file moved from `payments/config.yml` to `services/payments/config.yml`. Follow **View file history** to see where the timeout changed from 1800 to 600 ms. Open **Replay** to investigate the branch deletion and **Share investigation** to preserve your selection.

The local example uses a reproducible Git repository. Its pull request records are illustrative. The Forge build reads the installed Bitbucket repository as the current user. The [judge walkthrough](JUDGE.md) includes the fixture generator, team-workspace installation steps, and a scenario using real pull requests and push events.

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
