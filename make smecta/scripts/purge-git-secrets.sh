#!/usr/bin/env bash
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || die 'git is required'
git filter-repo --help >/dev/null 2>&1 || die 'git-filter-repo is required (https://github.com/newren/git-filter-repo)'
git rev-parse --git-dir >/dev/null 2>&1 || die 'run this inside the dedicated A-Step purge clone'

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || git rev-parse --git-dir)"
cd "$repo_root"

if [[ "$(git rev-parse --is-bare-repository)" != 'true' ]] && [[ -n "$(git status --porcelain)" ]]; then
  die 'the purge clone must be clean; back up or commit work elsewhere first'
fi

origin_url="$(git remote get-url origin 2>/dev/null || true)"
[[ -n "$origin_url" ]] || die 'origin is missing; use a fresh clone of the authoritative repository'
old_main="$(git rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$old_main" ]] || die 'refs/heads/main is missing'

printf '%s\n' 'This rewrites every local ref. Before continuing:'
printf '%s\n' '  1. Rotate/revoke the exposed administrator credential.'
printf '%s\n' '  2. Freeze merges and coordinate a team-wide re-clone window.'
printf '%s\n' '  3. Confirm this is a disposable, fresh purge clone.'
read -r -p 'Type PURGE to continue: ' confirmation
[[ "$confirmation" == 'PURGE' ]] || die 'cancelled'

read -r -p 'Exposed administrator email to redact: ' exposed_admin_email
read -r -s -p 'Exposed administrator password to redact: ' exposed_admin_password
printf '\n'
[[ -n "$exposed_admin_email" && -n "$exposed_admin_password" ]] || die 'both exposed values are required'
[[ "$exposed_admin_email" != *$'\n'* && "$exposed_admin_password" != *$'\n'* ]] || die 'credentials must be single-line values'

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_bundle="../a-step-before-secret-purge-${timestamp}.bundle"
git bundle create "$backup_bundle" --all
printf 'Offline recovery bundle created: %s\n' "$backup_bundle"

replacement_file="$(mktemp)"
cleanup() {
  rm -f -- "$replacement_file"
  unset exposed_admin_email exposed_admin_password
}
trap cleanup EXIT
printf 'literal:%s==>***REMOVED-ADMIN-EMAIL***\n' "$exposed_admin_email" > "$replacement_file"
printf 'literal:%s==>***REMOVED-ADMIN-PASSWORD***\n' "$exposed_admin_password" >> "$replacement_file"

git filter-repo --force --sensitive-data-removal \
  --replace-text "$replacement_file" \
  --filename-callback '
base = filename.rsplit(b"/", 1)[-1]
if filename.startswith(b".wrangler/") or b"/.wrangler/" in filename:
    return None
if base == b".env" or (base.startswith(b".env.") and base != b".env.example"):
    return None
if base == b".dev.vars" or (base.startswith(b".dev.vars.") and base != b".dev.vars.example"):
    return None
return filename
'

if git log --all -S "$exposed_admin_email" --format='%H' | grep -q .; then
  die 'email still appears in rewritten history'
fi
if git log --all -S "$exposed_admin_password" --format='%H' | grep -q .; then
  die 'password still appears in rewritten history'
fi
if git log --all --name-only --pretty=format: | grep -E '(^|/)(\.wrangler/|\.env($|\.)|\.dev\.vars($|\.))' >/dev/null; then
  die 'a prohibited secret path still appears in rewritten history'
fi

printf '\nLocal rewrite verification passed. git-filter-repo normally removes origin.\n'
printf 'After security/engineering review, restore it with:\n  git remote add origin %q\n' "$origin_url"
printf 'During the coordinated freeze, update main with an explicit lease:\n'
printf '  git push --force-with-lease=refs/heads/main:%s origin refs/heads/main:refs/heads/main\n' "$old_main"
printf '%s\n' 'Then review every non-main branch and tag; rewrite or delete each stale ref before reopening merges.'
printf '%s\n' 'Force-update approved rewritten tags only after that inventory.'
printf '%s\n' 'All team members must delete old clones/forks, clear CI caches/artifacts, and clone again.'
printf '%s\n' 'Post-push verification:'
printf '%s\n' '  git ls-remote --heads --tags origin'
printf '%s\n' '  Clone fresh, rerun secret scanning, and confirm the removed paths never appear in git log --all --name-only.'
printf '%s\n' '  Confirm GitHub secret scanning is clean and no Actions artifact or release asset retains the old bundle.'
