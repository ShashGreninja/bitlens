# Repository History

A repository-scoped Forge app follows a release regression from a pair of immutable commits to a file rename, its landing pull request, and recorded branch movements. The sample workspace runs the same React screens locally.

## Boundaries

- The web client owns one investigation selection across Compare, File history, Graph and Replay. A compact, versioned investigation token encodes immutable revisions, path, commit and event. Sharing must resolve inside the repository and enforce current viewer access.
- The client calls a typed history service. The local example implements the same contract as Forge. Production chooses the Forge service at build time. Failure to reach Bitbucket stays visible.
- A Forge resolver derives workspace and repository from installation context, checks access as the current user, validates input, and reads Bitbucket as that user. It normalizes paginated records into bounded result pages. Raw source and diffs are retrieved on demand.
- The push trigger writes immutable events to repository-scoped KVS keys. Stable event identities deduplicate retries. Replay uses event time and before/after pointers to show discontinuities, separate from Git commit authorship. Initial pointer observations establish coverage.
- Graph edges use parent hashes. The change list uses an endpoint-to-endpoint comparison. PR associations require evidence from Bitbucket. Folder moves are shown through the files that moved.

## Service contract

Shared types live in `shared/types.ts`. The single resolver `history` accepts `{op, ...parameters}`. Bootstrap returns repository information and revisions. Compare resolves revisions and returns file changes. Detail returns diff, historical paths and source links. Graph returns commits and labels. Replay returns recorded events and coverage. Tree returns directory entries. The local example and live resolver return identical shapes.

## Verification

Use asymmetric file changes for revision ordering, a renamed configuration file for lineage, a squash merge and regular merge for ancestry, and force-push and deletion events for replay. Browser tests exercise the visible investigation and share workflow. An authenticated install in a separate team workspace is the live acceptance gate.
