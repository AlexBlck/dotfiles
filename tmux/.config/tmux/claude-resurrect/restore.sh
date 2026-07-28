#!/usr/bin/env bash
# ABOUTME: Resumes the Claude Code session each pane was running when it was saved.
# ABOUTME: Runs from the tmux-resurrect post-restore-all hook.

set -u

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$CURRENT_DIR/helpers.sh"

# False for a pane that is missing or already busy, both of which mean the
# resume command would land somewhere it does not belong.
pane_awaits_command() {
    local command
    command="$(tmux display-message -p -t "$1" '#{pane_current_command}' 2>/dev/null)"
    case "$command" in
        bash|zsh|sh|fish|dash|ksh) return 0 ;;
        *) return 1 ;;
    esac
}

conversation_exists() {
    [ -n "$(find "$CLAUDE_PROJECTS_DIR" -name "${1}.jsonl" -print -quit 2>/dev/null)" ]
}

main() {
    local state
    state="$(state_file)"
    [ -s "$state" ] || return 0

    local session_name window pane session_id target count=0
    while IFS="$TAB" read -r session_name window pane session_id; do
        [ -n "$session_id" ] || continue
        target="${session_name}:${window}.${pane}"

        pane_awaits_command "$target" || continue
        conversation_exists "$session_id" || continue

        tmux send-keys -t "$target" "claude --resume $session_id" C-m
        count=$((count + 1))
    done < "$state"

    if [ "$count" -gt 0 ]; then
        tmux display-message "Resumed $count Claude session(s)"
    fi
    return 0
}
main
