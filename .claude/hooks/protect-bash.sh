#!/usr/bin/env bash
# Managed by harness setup. PreToolUse hook for Bash: blocks destructive, irreversible,
# outward-facing or secret-reading commands. Exit 2 = block, message on stderr goes to the agent.
set -u

input="$(cat)"
command -v jq >/dev/null 2>&1 || { echo "harness guard: jq is required but missing; refusing all Bash" >&2; exit 2; }

if ! printf '%s' "$input" | jq -e '
  type == "object" and
  (.tool_name | type == "string") and
  (if .tool_name == "Bash" then
     (.tool_input | type == "object") and (.tool_input.command | type == "string") and
     ((.cwd // "") | type == "string")
   else true end)
' >/dev/null 2>&1; then
  echo "harness guard: malformed hook input; refusing Bash" >&2
  exit 2
fi

tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
[ "$tool" = "Bash" ] || exit 0
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
[ -n "$cmd" ] || exit 0

# Two tiers. "always" rules protect every Claude session in the repository: destructive,
# irreversible, or secret-reading commands. "worker" rules apply only to unattended harness
# workers (HARNESS_WORKER=1 is set by the controller on the provider process and inherited
# by this hook): workers do not change Git state, publish, run project commands outside
# the sandboxed gate, or change OpenSpec state. Operators keep their normal Git workflow.
worker=0
[ "${HARNESS_WORKER:-}" = "1" ] && worker=1

block() {
  local tier="$1" reason="$2"
  if [ -n "$cwd" ] && [ -d "$cwd" ]; then
    mkdir -p "$cwd/.harness" 2>/dev/null && \
      printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tier" "$reason" "$cmd" >> "$cwd/.harness/blocked.log" 2>/dev/null
  fi
  if [ "$worker" = 1 ]; then
    local category="destructive"
    [ "$tier" = worker ] && category="scope"
    cat >&2 <<MSG
harness guard: blocked ($reason).
This action is outside what a harness worker may do. Do not work around it.
If the task genuinely requires it, stop and report status "needs_human" with reason "$category".
MSG
  else
    cat >&2 <<MSG
harness guard: blocked ($reason).
The guard installed by harness setup blocks destructive, irreversible, or secret-reading
commands in every Claude session in this repository. Run it yourself outside Claude if you intend it.
MSG
  fi
  exit 2
}

matches() { printf '%s' "$cmd" | grep -qiE -e "$1"; }
always() { matches "$1" && block always "$2"; }
worker_only() { [ "$worker" = 1 ] && matches "$1" && block worker "$2"; }

# A command segment (split on ; & |) that starts with the given text.
runs() {
  local needle="$1" segment
  while IFS= read -r segment; do
    segment="${segment#"${segment%%[![:space:]]*}"}"
    [ -n "$segment" ] && [[ "$segment" == "$needle"* ]] && return 0
  done <<< "${cmd//[;&|]/$'\n'}"
  return 1
}

always '(^|[;&|[:space:]])rm([^;&|]*[[:space:]])(--recursive|-[a-zA-Z]*[rR][a-zA-Z]*)([[:space:]]|$)' "recursive delete"
always '(^|[;&|[:space:]])(mkfs|dd[[:space:]]+if=|shred)([[:space:]]|$)' "disk-level destructive command"
always ':\(\)[[:space:]]*\{' "fork bomb"
always '(^|[;&|[:space:]])sudo([[:space:]]|$)' "privilege escalation"
always 'chmod[[:space:]]+(-R[[:space:]]+)?[0-7]*777' "world-writable chmod"
always '(curl|wget)[^|]*\|[[:space:]]*(ba|z|da)?sh([[:space:]]|$)' "pipe remote script to shell"

always 'git[[:space:]]+reset[[:space:]]+--hard' "git reset --hard discards work"
always 'git[[:space:]]+checkout[[:space:]]+(--[[:space:]]+|\.([[:space:]]|$))' "git checkout discards changes"
if matches 'git[[:space:]]+restore([[:space:]]|$)' && ! matches 'git[[:space:]]+restore[[:space:]]+--staged'; then
  block always "git restore discards changes"
fi
always 'git[[:space:]]+clean[[:space:]]+-[a-z]*[fx]' "git clean deletes untracked files"
always 'git[[:space:]]+(filter-branch|filter-repo)([[:space:]]|$)' "history rewrite"
always 'git[[:space:]]+(branch[[:space:]]+-D|tag[[:space:]]+-d|stash[[:space:]]+(drop|clear))' "deletes git refs"

always 'db:(drop|reset|rollback|schema:load|structure:load)' "destructive database task"
always '(prisma[[:space:]]+migrate[[:space:]]+reset|alembic[[:space:]]+downgrade)' "destructive database task"
always '(^|[^a-z])(drop[[:space:]]+(table|database|schema)|truncate[[:space:]]+table)([^a-z]|$)' "destructive SQL"
always 'delete[[:space:]]+from[[:space:]]+[a-z_."]+[[:space:]]*;?[[:space:]]*$' "unbounded SQL delete"

always 'terraform[[:space:]]+(apply|destroy)' "infrastructure change"
always 'kubectl[[:space:]]+(delete|apply|drain|scale)' "infrastructure change"
always 'helm[[:space:]]+(uninstall|delete|upgrade|install)' "infrastructure change"
always 'aws[[:space:]]+.*[[:space:]](delete|terminate|rm|put-bucket-policy)' "infrastructure change"
always 'docker[[:space:]]+(rm|rmi|system[[:space:]]+prune|volume[[:space:]]+(rm|prune))' "removes docker state"

secret_scan="$(printf '%s' "$cmd" | sed -E 's/\.env\.(example|sample|template)([^a-zA-Z0-9_.-]|$)/\2/g')"
printf '%s' "$secret_scan" | grep -qiE '(^|[^a-z0-9_])\.env(\.[a-z0-9_-]+)?([^a-z0-9_.-]|$)' && block always "touches .env secrets"
always '(^|[/[:space:]"'"'"'])secrets/' "touches secrets/"
always '(^|[;&|[:space:]])(printenv|env)[[:space:]]*($|[;&|])' "dumps environment"
always '\$[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*' "reads a secret variable"

always '--dangerously-skip-permissions|--dangerously-bypass|bypassPermissions' "permission bypass"

worker_only 'git[^;&|]*[[:space:]]push([[:space:]]|$)' "harness workers do not push"
worker_only 'git[^;&|]*[[:space:]](add|commit|config|update-index|write-tree|read-tree|symbolic-ref|update-ref)([[:space:]]|$)' "harness workers do not change Git state; the controller checkpoints accepted work"
worker_only 'git[[:space:]]+rebase([[:space:]]|$)' "harness workers do not rewrite history"
worker_only 'gh[[:space:]]+(pr|issue|release|repo)[[:space:]]+(create|merge|close|delete|edit|comment)' "harness workers do not write to GitHub"
worker_only '(npm|pnpm|yarn)[[:space:]]+publish|gem[[:space:]]+push|cargo[[:space:]]+publish|docker[[:space:]]+push' "harness workers do not publish artifacts"
worker_only '(^|[;&|[:space:]])openspec[[:space:]]+(archive|new|init|update|change)([[:space:]]|$)' "harness workers do not change OpenSpec state"

if [ "$worker" = 1 ]; then
  config="${CLAUDE_PROJECT_DIR:-$cwd}/.harness/config.json"
  if [ -f "$config" ]; then
    while IFS= read -r configured; do
      [ -n "$configured" ] && runs "$configured" && \
        block worker "harness workers do not run project commands outside the sandboxed gate"
    done < <(jq -r '.test, .lint, .typecheck | select(type == "string" and . != "")' "$config" 2>/dev/null)
  fi
fi

exit 0
