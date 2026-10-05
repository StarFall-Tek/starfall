#!/usr/bin/env bash
# Regenerate public/scout/desk.json from the Crypto Scout paper book and commit + push it.
# Safe for the market-watch routine to call after every run:
#   bash /workspace/starfall-scout/scripts/sync-desk.sh
# Options / env:
#   SCOUT_SRC=<dir>        source crypto-bot folder (read only)
#   SCOUT_BRANCH=<branch>  branch to commit to (default: current branch; refuses main unless SCOUT_ALLOW_MAIN=1)
#   --no-push              commit only
#   --deploy               also run `netlify deploy --prod` (only when this branch should be live)
# Never force-pushes. Only desk.json is staged.
set -euo pipefail
cd "$(dirname "$0")/.."
PUSH=1; DEPLOY=0
for a in "$@"; do
  case "$a" in
    --no-push) PUSH=0 ;;
    --deploy) DEPLOY=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

FILE=public/scout/desk.json
BRANCH="${SCOUT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
if [ "$BRANCH" = "HEAD" ]; then echo "sync-desk: detached HEAD; set SCOUT_BRANCH" >&2; exit 1; fi
if [ "$BRANCH" = "main" ] && [ "${SCOUT_ALLOW_MAIN:-0}" != "1" ]; then
  echo "sync-desk: refusing to commit to main (set SCOUT_ALLOW_MAIN=1 after the PR merges)" >&2; exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then git switch "$BRANCH" >/dev/null; fi

node scripts/export-desk.mjs

# Only commit when something other than generated_at changed.
if git diff --quiet -- "$FILE" 2>/dev/null && git ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
  echo "sync-desk: no change"; exit 0
fi
if git ls-files --error-unmatch "$FILE" >/dev/null 2>&1 && \
   [ -z "$(git diff -U0 -- "$FILE" | grep -E '^[+-] ' | grep -v '"generated_at"')" ]; then
  git checkout -- "$FILE"; echo "sync-desk: only timestamp changed; skipped"; exit 0
fi

git add -- "$FILE"
git commit -q -m "Sync Crypto Scout desk ($(date '+%Y-%m-%d %H:%M %Z'))" -- "$FILE"
echo "sync-desk: committed $(git rev-parse --short HEAD) on $BRANCH"

if [ "$PUSH" = "1" ]; then
  if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    git fetch -q origin "$BRANCH"
    git rebase -q "origin/$BRANCH"   # local-only commits; never rewrites the remote
  fi
  git push -q origin "HEAD:refs/heads/$BRANCH"
  echo "sync-desk: pushed to origin/$BRANCH"
fi

if [ "$DEPLOY" = "1" ]; then
  netlify deploy --prod --build --message "Crypto Scout desk sync"
fi
