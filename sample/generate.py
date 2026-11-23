"""Build the offline evidence and a judge checkout using only Python and Git."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import subprocess
import sys


class Sample:
    def __init__(self, path):
        path.mkdir(parents=True, exist_ok=True)
        if any(path.iterdir()):
            raise ValueError("Choose an empty destination for the sample checkout.")
        self.path = path
        self.env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        self.env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, LC_ALL="C")
        self.time = datetime(2026, 11, 16, 9, tzinfo=timezone.utc)
        self.events = []
        self.commits = []
        self.prs = {}
        self.git("init", "--object-format=sha1", "-b", "seed")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "user.name", "Release Engineering")
        self.git("config", "user.email", "release@example.invalid")

    def git(self, *args):
        proc = subprocess.run(["git", *args], cwd=self.path, env=self.env,
                              capture_output=True, check=False)
        if proc.returncode:
            raise RuntimeError(proc.stderr.decode(errors="replace"))
        return proc.stdout.decode("utf-8")

    def tick(self):
        self.time += timedelta(minutes=17)
        return self.time.isoformat()

    def write(self, path, contents):
        dest = self.path / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(contents.encode())

    def commit(self, message, author, merge=None):
        stamp = self.tick()
        self.env.update(GIT_AUTHOR_NAME=author, GIT_AUTHOR_EMAIL=author.lower().replace(" ", ".")+"@example.invalid",
                        GIT_AUTHOR_DATE=stamp, GIT_COMMITTER_DATE=stamp)
        self.git("add", "-A")
        if merge:
            self.git("merge", "--no-ff", "-m", message, merge)
        else:
            self.git("commit", "-m", message)
        result = self.git("rev-parse", "HEAD").strip()
        self.commits.append(result)
        return result

    def point(self, ref, target, actor, record=True):
        before = self.git("for-each-ref", "--format=%(objectname)", ref).strip() or None
        if target:
            self.git("update-ref", ref, target, before or "0" * 40)
        else:
            self.git("update-ref", "-d", ref, before)
        after = self.git("for-each-ref", "--format=%(objectname)", ref).strip() or None
        assert after == target
        if not record:
            return
        if not after:
            kind = "delete"
        elif ref.startswith("refs/tags/"):
            kind = "tag"
        elif not before:
            kind = "create"
        elif before in self.git("rev-list", after).splitlines():
            kind = "push"
        else:
            kind = "force-push"
        self.observe(ref, kind, before, after, actor)

    def observe(self, ref, kind, before, after, actor):
        self.events.append(dict(id=f"example-event-{len(self.events)+1:02d}",
                                ref=ref.split("/", 2)[2], kind=kind, before=before, after=after,
                                refType="tag" if ref.startswith("refs/tags/") else "branch",
                                actor=actor, date=self.tick()))

    def build(self):
        old, new = "payments/config.yml", "services/payments/config.yml"
        config = ("service: payments\nregion: eu-west-1\nprovider: card-gateway\n"
                  "timeout_ms: 1200\nretries: 2\ncurrency: USD\nlog_level: info\n")
        self.write(old, config)
        self.write("VERSION", "1.4\n")
        self.write("payments/legacy.env", "PAYMENTS_TIMEOUT_MS=1800\n")
        self.commit("Initialize payment service configuration", "Maya Chen")
        self.write(old, config.replace("1200", "1800"))
        base = self.commit("Allow the gateway 1800 ms to respond", "Maya Chen")
        self.git("checkout", "--detach", base)
        self.git("branch", "-D", "seed")
        main = "refs/heads/main"
        tag = "refs/tags/v1.4"
        for ref in (main, tag):
            self.point(ref, base, "", record=False)
            self.observe(ref, "snapshot", None, self.git("rev-parse", ref).strip(), "Example recorder")

        feature = "refs/heads/feature/payment-timeout"
        self.point(feature, base, "Maya Chen")
        (self.path / new).parent.mkdir(parents=True)
        self.git("mv", old, new)
        moved = self.commit("Move the payment configuration into services", "Maya Chen")
        self.point(feature, moved, "Maya Chen")
        self.write(new, config.replace("1200", "600"))
        self.git("rm", "payments/legacy.env")
        tip = self.commit("Reduce the gateway timeout to 600 ms", "Maya Chen")
        self.point(feature, tip, "Maya Chen")

        self.git("checkout", "--detach", base)
        docs = "refs/heads/docs/payment-runbook"
        self.point(docs, base, "Sam Rivera")
        self.write("docs/payment-runbook.md", "# Payment incident runbook\n\nInspect gateway latency and the configured timeout.\n")
        doc_tip = self.commit("Document payment incident triage", "Sam Rivera")
        self.point(docs, doc_tip, "Sam Rivera")
        self.git("checkout", "--detach", base)
        self.write("VERSION", "1.5\n")
        prep = self.commit("Prepare the 1.5 release", "Nora Patel")
        self.point(main, prep, "Release Engineering")
        merged = self.commit("Merge the payment incident runbook", "Nora Patel", merge=doc_tip)
        self.prs[merged] = dict(id=41, title="Illustrative PR · Document payment incident triage",
                                strategy="Merge commit", source=doc_tip)
        self.point(main, merged, "Nora Patel")
        self.git("merge", "--squash", tip)
        squash = self.commit("Relocate payment configuration and shorten the timeout", "Nora Patel")
        self.prs[squash] = dict(id=42, title="Illustrative PR · Relocate payment configuration",
                                strategy="Squash", source=tip)
        self.point(main, squash, "Nora Patel")
        self.point(feature, None, "Nora Patel")
        self.point("refs/tags/v1.5", squash, "Release Engineering")

        audit = "refs/heads/investigate/gateway-latency"
        self.git("checkout", "--detach", squash)
        self.write("notes/incident.md", "Review gateway retry telemetry.\n")
        first = self.commit("Capture initial gateway observations", "Sam Rivera")
        self.point(audit, first, "Sam Rivera")
        self.git("checkout", "--detach", squash)
        self.write("notes/incident.md", "Compare gateway latency against the release timeout.\n")
        second = self.commit("Revise gateway investigation notes", "Sam Rivera")
        self.point(audit, second, "Sam Rivera")
        for name, value in dict(moved=moved, feature=tip, docs=doc_tip, prep=prep,
                                force_before=first, force_after=second).items():
            self.git("update-ref", "refs/fixture/"+name, value)
        self.git("checkout", "main")

    def history(self, sha, path):
        log = self.git("log", "--format=%x1e%H", "--name-status", "--follow", sha, "--", path)
        history = []
        for record in log.split("\x1e")[1:]:
            hash_, *rows = record.strip().splitlines()
            history.append([hash_, path])
            for row in rows:
                if row.startswith("R"):
                    _, previous, current = row.split("\t")
                    if path == current:
                        path = previous
        return history

    def export(self):
        commits, history, trees = {}, {}, {}
        for sha in self.commits:
            fields = self.git("show", "-s", "--format=%P%x00%s%x00%an%x00%aI", sha).strip().split("\x00")
            parents, message, author, date = fields
            commits[sha] = dict(hash=sha, parents=parents.split(), message=message, author=author, date=date)
            paths = self.git("ls-tree", "-r", "--name-only", sha).splitlines()
            trees[sha] = {path: self.git("show", sha+":"+path) for path in paths}
            history[sha] = {path: self.history(sha, path) for path in paths}

        # These patches are Git's own directional diffs, shared between all pairs with the same file change.
        patches, patch_indices, comparisons = [], {}, {}
        for base in self.commits:
            comparisons[base] = {}
            for target in self.commits:
                diff = self.git("diff", "--no-color", "--no-ext-diff", "--no-textconv", "--abbrev=7",
                                "--find-renames=50%", "--unified=3", base, target)
                indices = []
                for body in diff.split("diff --git ")[1:]:
                    patch = "diff --git " + body
                    if patch not in patch_indices:
                        names = body.splitlines()[0].split(" ")
                        old, new = names[0][2:], names[1][2:]
                        if "\nnew file mode " in patch:
                            status, old = "added", None
                        elif "\ndeleted file mode " in patch:
                            status, new = "removed", None
                        else:
                            status = "renamed" if old != new else "modified"
                        hunk = patch.partition("\n@@")[2].splitlines()[1:]
                        change = dict(status=status, oldPath=old, newPath=new,
                                      added=sum(line.startswith("+") for line in hunk),
                                      removed=sum(line.startswith("-") for line in hunk))
                        patch_indices[patch] = len(patches)
                        patches.append(dict(change=change, diff=patch))
                    indices.append(patch_indices[patch])
                comparisons[base][target] = indices
        refs = []
        for kind, namespace in [("branch", "refs/heads"), ("tag", "refs/tags")]:
            lines = self.git("for-each-ref", "--format=%(refname:strip=2) %(objectname)", namespace)
            for line in lines.splitlines():
                name, hash_ = line.split()
                refs.append(dict(name=name, hash=hash_, kind=kind))
        return dict(commits=commits, trees=trees, history=history, patches=patches,
                    comparisons=comparisons, refs=refs, events=self.events, prs=self.prs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkout", type=Path, help="New or empty directory for the judge repository")
    parser.add_argument("--export", type=Path, help="Write the example evidence JSON to this path")
    args = parser.parse_args()
    sample = Sample(args.checkout)
    sample.build()
    if args.export:
        args.export.write_bytes((json.dumps(sample.export(), indent=2, ensure_ascii=False) + "\n").encode())
    print("Created local judge repository at", args.checkout.resolve())


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as exc:
        sys.exit(str(exc))
