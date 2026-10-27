#!/usr/bin/env python3
"""CI guard: only daily-snapshot.yml may request `pull-requests: write`, and no workflow may
auto-merge or approve PRs (Actions may create PRs, but a human approves and merges them)."""
import re, sys
from pathlib import Path

ALLOWED_PR_WRITE = {"daily-snapshot.yml"}
PR_WRITE = re.compile(r"pull-requests\s*:\s*['\"]?write|permissions\s*:\s*['\"]?write-all")
FORBIDDEN = [
    (re.compile(r"gh\s+pr\s+merge"), "gh pr merge"),
    (re.compile(r"gh\s+pr\s+review\b[^\n]*(--approve|\s-a\b)"), "gh pr review --approve"),
    (re.compile(r"(?<![\w-])--auto\b"), "--auto"),
    (re.compile(r"enablePullRequestAutoMerge|addPullRequestReview|/pulls/[^\s]*/(reviews|merge)", re.I), "API merge/approve"),
    (re.compile(r"auto-?merge|auto-?approve", re.I), "auto-merge/approve action"),
]

def main(root: str = ".github/workflows") -> int:
    errors = []
    for f in sorted(Path(root).glob("*.y*ml")):
        for n, line in enumerate(f.read_text().splitlines(), 1):
            code = line.split("#", 1)[0] if not line.lstrip().startswith("#") else ""
            if PR_WRITE.search(code) and f.name not in ALLOWED_PR_WRITE:
                errors.append(f"{f}:{n}: pull-requests: write is only allowed in {sorted(ALLOWED_PR_WRITE)}")
            for rx, what in FORBIDDEN:
                if rx.search(code):
                    errors.append(f"{f}:{n}: forbidden {what}")
    for e in errors:
        print("FAIL", e)
    print("workflow_guard:", "FAIL" if errors else "ok")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
