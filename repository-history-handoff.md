# Repository History for Bitbucket

Engineering handoff for Codegeist 2026 · November 24, 2026

**Product proposal.** Build a Bitbucket Cloud Forge app that helps an engineer trace a regression from two known revisions to the exact file change, the pull request that landed it, and the recorded branch event. A teammate can reopen the investigation from a link that preserves the selected revisions and evidence.

**Entry.** Apps for Software Teams. Forge plus Bitbucket Cloud satisfies the technical requirement. Registration and submissions close December 22, 2026 at noon PST, which is December 23 at 1:30 a.m. IST. [Official rules](https://codegeist2026.devpost.com/rules)

## User and opportunity

The primary user is an engineer investigating a regression with a known file path, a release window, or two revisions. Release leads and incoming on-call engineers use the same evidence to verify a change or continue an investigation.

Bitbucket already provides a commit view and comparisons with diffs, commits, and merged pull requests. Atlassian documents a specific gap in the Cloud UI when a file has been renamed, while its Source API can follow those renames. The proposed app uses that file history as the entry point to a connected workflow. It links the change to how it reached the target revision and lets users replay branch movements that the app recorded. [Bitbucket comparisons](https://support.atlassian.com/bitbucket-cloud/docs/repository-tags/) · [Cloud UI limitation](https://support.atlassian.com/bitbucket-cloud/kb/bitbucket-commits-full-history-does-not-appear-after-migration-to-cloud/) · [Open request BCLOUD-589](https://jira.atlassian.com/browse/BCLOUD-589) · [Source API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-source/)

## Product experience

Open **Repository History** from the repository’s **Apps** menu. Start with the default branch and release tags, with side branches expandable. A single selection of repository, revisions, path, commit, and event carries across the views.

| View | Expected behavior |
| --- | --- |
| Compare | Select two release tags or commits. Resolve both to commit hashes. Group added, removed, modified, and renamed files by directory. Show the selected file’s diff and open the source tree at either revision. |
| File history | Start from the selected revision and path. Show previous paths, change commits, and a link to each available PR. Keep exact file renames visible. Where several file renames suggest a directory move, display the underlying file changes as evidence. |
| Graph | Draw ancestry from commit parent hashes. Show branch and tag labels, selected commits, and pointers to the source records. A squash merge can link to the originating PR while preserving Git’s actual parent edges. |
| Replay | Step through recorded branch creation, pushes, force-pushes, deletion, and tag changes. Before and after each event, show where the affected branch or tag pointed and label the date from which replay is available. |
| Share | Copy a link that preserves both commit hashes, the selected path, and any selected event. Offer a short Markdown summary with Bitbucket source links once sharing works end to end. |

Provide a keyboard-accessible list of commits and events alongside the graph. Keep the baseline and target visible, provide a clear empty state for repositories with few commits or no tags, and distinguish loading, incomplete event history, and inaccessible source records.

## Delivery scope

**Judge-ready core.** One repository per investigation. Ship revision comparison, rename-aware file history, exact commit and available PR links, branch replay, and a shareable investigation. Test with tags and raw commit hashes. Support regular and squash merges, a deleted branch, and a recorded force-push. A judge can run the workflow on the sample repository using their own Bitbucket Cloud team workspace.

**First stretch.** Add successful Bitbucket Pipelines deployments as comparison points. Start with a single environment. Anchor each comparison to the commit recorded by the deployment. Use releases or tags as the fallback when deployment history is unavailable. [Cloud Deployments API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-deployments/) · [Forge deployment events](https://developer.atlassian.com/platform/forge/events-reference/bitbucket/#deployment-completed)

**Bonus candidate.** Expose a read-only `rovo:mcp` tool that accepts a repository, two revisions, and a path, then returns the same diff, commit, PR, and deployment links as the UI where available. Enter the MCP bonus only after verifying custom-tool access and repository authorization in a fresh installation. Broader opportunities include reusable incident summaries and deployment comparisons across repositories. [Codegeist bonus rules](https://codegeist2026.devpost.com/rules) · [Rovo MCP module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/)

## Proposed implementation

| Layer | Decision |
| --- | --- |
| Bitbucket entry point | Declare `bitbucket:repoMainMenuPage` in the Forge manifest and open the repository-scoped Custom UI page. [Module reference](https://developer.atlassian.com/platform/forge/manifest-reference/modules/bitbucket-repository-main-menu-page/) |
| UI | React and TypeScript in Forge Custom UI. Use Cytoscape.js for graph rendering. Paginate history and show a bounded graph around the selected revisions. [Forge UI options](https://developer.atlassian.com/platform/forge/ui-kit/overview/) · [Cytoscape.js](https://js.cytoscape.org/) |
| Server | Forge functions on Node.js 24. Use `requestBitbucket` for commits, refs, source, diffs, and PRs. Verify the supported authorization context for each call against an installed app before relying on background fetches. [Forge runtime](https://developer.atlassian.com/platform/forge/function-reference/nodejs-runtime/) · [Bitbucket authentication](https://developer.atlassian.com/platform/forge/apis-reference/fetch-api-product.requestbitbucket/) |
| Storage | Forge KVS for repository-scoped commit metadata, current branch and tag pointers, observed events, and sync progress. Fetch file trees and diffs on demand under the viewer’s repository access. [Forge KVS](https://developer.atlassian.com/platform/forge/storage-reference/kvs/) |
| Ingestion | At setup, import commits reachable from existing branches and tags and record the initial pointers. Subscribe to `avi:bitbucket:push:repository`. Store before and after hashes, actor, event time, and creation, deletion, or force-push flags where available. Supplement abbreviated events with API reads. [Commits API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/) · [Refs API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-refs/) · [Push events](https://developer.atlassian.com/platform/forge/events-reference/bitbucket/#repository-pushed) |

### Correctness and access

- **Compare immutable revisions.** Resolve a tag or branch to a hash when selected. For endpoint-to-endpoint comparisons, use `topic=false` and test Bitbucket’s commit argument order with an asymmetric fixture so added and removed files are labeled correctly. [Bitbucket compare semantics](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/)
- **Preserve evidence.** Use commit parent hashes as ancestry. Link a PR through its documented merge commit or recorded merge data where available. Render a plain commit link when the PR association is unknown. [Pull requests API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/)
- **Handle replay gaps.** Deduplicate event retries, account for delayed deliveries, and reconcile current pointers against Bitbucket. Flag intervals with incomplete capture. Imported commits provide ancestry before installation. Replay starts at the initial snapshot and covers events observed from then on.
- **Recheck permissions.** Scope stored records by workspace and repository IDs. Verify the current viewer can read the repository before returning stored history, file data, or shared investigation details. Apply the same access checks to any bonus tool. Keep commit author and push actor as distinct fields.
- **Handle unavailable objects.** A stored event can still show an old branch pointer if Bitbucket later stops serving that commit. Surface the stored hash and availability status. Open source and diffs when the underlying revision is accessible.

## Suggested build order

1. **Prove the integration.** Install a minimal repository page in a shared Bitbucket Cloud team workspace. Confirm the source, rename history, diff, and PR endpoints on a real repository. Record and inspect one ordinary push and one branch deletion. Verify how event handling and subsequent API reads are authorized. [Bitbucket Forge setup](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-bitbucket/)
2. **Ship the investigation first.** Resolve two revisions, return a directional diff, follow a renamed file, and link the landing PR. Wire a path-focused list and the commit graph to the same selection.
3. **Add branch replay and sharing.** Persist the initial branch pointers and observed changes. Test merge, branch deletion, force-push, and late or duplicate events. Restore a shared investigation by its fixed commit hashes and check access with a second user.
4. **Prepare the judge build.** Create the sample history and exact install and test instructions. Rerun the scenario in a fresh installation before adding deployments or the MCP tool.

## Judge scenario and acceptance checks

Create a sample repository where `v1.4` contains `payments/config.yml`. After recording begins, create a branch that moves the file to `services/payments/config.yml` and changes a timeout value. Squash-merge the PR, delete its source branch, and tag the resulting revision `v1.5`. Add an independent regular merge for a second validation case.

- [ ] Selecting `v1.4` and `v1.5` shows old and new paths and the correct value change.
- [ ] Starting from the new path reaches at least one relevant change made under the old path.
- [ ] The app links the PR that landed the change and draws the true Git parent relationships for regular and squash merges.
- [ ] Replay shows the source branch’s last recorded commit before deletion. A second fixture shows both pointers in a recorded force-push.
- [ ] A second authorized user opens the shared link and sees the same commit hashes and path. An account without repository access receives no investigation data.
- [ ] The sample setup and investigation work on a fresh judge-style installation. Any performance or time-saved result in the submission comes from a measured comparison with the stock workflow and includes the sample size.

## Submission checklist

- [ ] Deploy to Forge production, enable sharing, and verify the installation link outside the development workspace. [Forge distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app)
- [ ] Provide setup and test instructions with the required workspace type, fixture steps, and the expected results.
- [ ] Record a public YouTube demo under five minutes. Start with the renamed-file regression and finish with the shared investigation.
- [ ] Submit under **Apps for Software Teams**. Explain how the app uses Forge and Bitbucket Cloud, and include bonus materials if entering. [Official submission rules](https://codegeist2026.devpost.com/rules)
