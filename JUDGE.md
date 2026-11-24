# Judge walkthrough

## Explore the local example

From the app checkout, run `npm ci` and `npm run dev` with Node.js 24. Open the URL printed by Vite for the real Bitbucket graph. Append `/?fixture=1` to the server origin for the controlled walkthrough below. The example reads bundled Git evidence and works without a Bitbucket account.

1. Open **Compare** and select `v1.4` and `v1.5`. Select `services/payments/config.yml`. The patch shows the rename from `payments/config.yml` and a timeout decrease from 1800 ms to 600 ms. The release also adds a runbook, removes a legacy environment file, and updates `VERSION`. Reverse the revisions to see the opposite change.
2. In **File history**, follow the configuration through its previous path to “Allow the gateway 1800 ms to respond.” Open the landing pull request for the target revision. Local PR #42 illustrates the squash merge. Local PR #41 illustrates the regular merge and can be opened from its commit evidence. Both PR records are illustrative. The commit hashes, trees, diffs and parent edges come from Git.
3. In **Graph**, inspect `41bc3e5`. Its sole parent is `6d5cf47`, the regular merge with parents `2b372a8` and `054419d`. The squashed feature tip `0c0dd7a` remains discoverable through the deletion event and PR evidence.
4. In **Replay**, inspect the deletion of `feature/payment-timeout` and the force-push of `investigate/gateway-latency`. Their last tip and before/after tips are `0c0dd7a` and `14a992d` → `74ab3b4`, respectively. The local recorder reads each Git ref before and after updating it. Actors and dates follow the fixture script. The hosted walkthrough below exercises Forge event delivery.
5. Choose **Show ancestry at this event** on the force-push. Switch between **Before event** and **After event** to see the two histories. Use the event slider to inspect another point in time.
6. Copy the investigation link and reopen it. With the same local server running, it restores the selected release pair, file, and event. A second user's access must be tested on the installed app.

### Verify against Git

Using Python 3 and Git, generate the repository in a new or empty directory. On systems where Python is called `python3`, substitute that command. The generator operates locally and configures no remote.

```sh
python sample/generate.py ../payment-history-judge
git -C ../payment-history-judge diff --find-renames v1.4 v1.5
git -C ../payment-history-judge log --follow --name-status v1.5 -- services/payments/config.yml
git -C ../payment-history-judge log --graph --oneline --all --decorate
git -C ../payment-history-judge rev-list --parents -n 2 v1.5
```

To regenerate the data for comparison, add `--export ../history-rebuilt.json` to the generator command, using a fresh checkout directory. Compare the output with `sample/history.json`. Run `npm test` for the service checks.

## Run the investigation in a shared Bitbucket Cloud team workspace

Use an empty **private** test repository, a workspace administrator who can install apps and push to the repository, a second account with read access, and a signed-in account without access. Choose a test repository that permits branch creation, source branch deletion and a force-push on the disposable investigation branch. Enable both the **Merge commit** and **Squash** strategies in repository settings. [Forge workspace requirements](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-bitbucket/) · [Bitbucket merge settings](https://support.atlassian.com/bitbucket-cloud/docs/pull-request-and-merge-settings/)

### Seed the initial pointers

Use the generated Git checkout from the previous section. The commands below use Git Bash or another POSIX shell. Replace `WORKSPACE` and `REPOSITORY` with the slugs of your empty judge repository.

```sh
cd ../payment-history-judge
git remote add judge git@bitbucket.org:WORKSPACE/REPOSITORY.git
git push judge refs/tags/v1.4:refs/heads/main refs/tags/v1.4
```

Confirm in Bitbucket that the repository's main branch is `main`. At this point both `main` and `v1.4` point to `30c3e78`.

### Install and establish replay coverage

For the hosted walkthrough, use a Node.js version supported by the Forge CLI. Check the published range with `npm view @forge/cli engines` before installing it.

In the **application checkout**, install with the Forge CLI using your own development app registration. The manifest begins with a placeholder app ID. `forge register` writes the registered ID to that checkout. If testing an already registered copy owned by your team, use its existing ID. [Forge CLI registration](https://developer.atlassian.com/platform/forge/cli-reference/register/)

```sh
npm ci
npm run build
npm install -g @forge/cli
forge login
forge register
forge deploy -e development
forge install -e development
```

When prompted, select **Bitbucket** and enter your team workspace URL. Open the seeded repository, choose **Apps → Repository History**, and open **Replay**. Confirm coverage has begun and the initial `main` and `v1.4` pointers are visible before continuing. With a previously installed app, this first repository visit still establishes its baseline. [Forge deployment and workspace installation](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-bitbucket/)

### Create actual pull requests and replay events

1. In the **generated Git checkout**, publish the rename, the timeout edit, and the independent runbook work. Each command creates a separate observable change.

   ```sh
   git push judge refs/tags/v1.4:refs/heads/feature/payment-timeout
   git push judge refs/fixture/moved:refs/heads/feature/payment-timeout
   git push judge refs/fixture/feature:refs/heads/feature/payment-timeout
   git push judge refs/tags/v1.4:refs/heads/docs/payment-runbook
   git push judge refs/fixture/docs:refs/heads/docs/payment-runbook
   git push judge refs/fixture/prep:refs/heads/main
   ```

2. In Bitbucket, open a pull request from `docs/payment-runbook` into `main`. Choose **Merge commit** and keep its source branch. Record the PR URL and merge hash. Then open a separate pull request from `feature/payment-timeout` into `main`, choose **Squash**, and select **Close source branch**. Record the second PR URL and landing hash. Performing both merges in Bitbucket gives the app real PR metadata. Bitbucket assigns the IDs and landing hashes in this repository. [Merge a Bitbucket pull request](https://support.atlassian.com/bitbucket-cloud/docs/merge-a-pull-request/)

3. Tag the actual destination tip in the judge repository. The explicit refspec uses the server's squash commit.

   ```sh
   git fetch --no-tags judge refs/heads/main:refs/remotes/judge/main
   git push judge refs/remotes/judge/main:refs/tags/v1.5
   git rev-list --parents -n 2 refs/remotes/judge/main
   ```

4. Produce a recorded non-fast-forward change. Both commits start at the hosted squash commit. The lease restricts the rewrite to the exact previous tip of the disposable `investigate/gateway-latency` branch. Save the two hashes printed by `git rev-parse`.

   ```sh
   git switch --detach refs/remotes/judge/main
   git cherry-pick refs/fixture/force_before
   before=$(git rev-parse HEAD)
   git push judge HEAD:refs/heads/investigate/gateway-latency
   git switch --detach refs/remotes/judge/main
   git cherry-pick refs/fixture/force_after
   git rev-parse "$before" HEAD
   git push --force-with-lease="refs/heads/investigate/gateway-latency:$before" judge HEAD:refs/heads/investigate/gateway-latency
   ```

### Check the installed app

| Check | Expected evidence |
| --- | --- |
| Compare `v1.4` → `v1.5`; repeat with full hashes from `git rev-parse v1.4 refs/remotes/judge/main` | Both comparisons show the same four changed files. The configuration moved and its timeout fell from 1800 to 600. Reversing the endpoints reverses the patch, addition and removal. |
| Open the configuration history and the linked PR | Older entries show `payments/config.yml`. The squash landing record points to the PR created in this workspace. Open a source link at each available revision to check its contents. |
| Inspect the two landing commits | The regular merge has two Git parents. The squash landing has one. Compare the displayed parent hashes with the `rev-list` output. |
| Inspect Replay after event delivery | The feature branch deletion retains the tip from `git rev-parse refs/fixture/feature`. The force-push shows the two hashes recorded above. Refresh to check delayed delivery. Record any gap reported by the app. |
| Share the investigation after selecting the renamed file and an event | A second signed-in repository reader sees the same baseline hash, target hash, file, and selected event. A signed-in account without repository permission receives no investigation data. |

Use the live PR URLs, shared investigation link, and observed replay entries for the hosted acceptance record. Local reproduction verifies the fixture and UI data only. Workspace installation, event delivery and multi-account access require this hosted run.
