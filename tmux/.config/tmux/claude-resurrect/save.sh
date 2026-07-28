#!/usr/bin/env bash
# ABOUTME: Records which tmux pane each running Claude Code session belongs to.
# ABOUTME: Runs from the tmux-resurrect post-save-all hook.

set -u

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$CURRENT_DIR/helpers.sh"

# Walks up from a process to the pane whose shell owns it, so sessions started
# through a wrapper are still attributed to the right pane.
pane_for_process() {
    local pid="$1" panes="$2" pane
    while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
        pane="$(grep "^${pid}${TAB}" "$panes" | head -1 | cut -f2-)"
        if [ -n "$pane" ]; then
            echo "$pane"
            return 0
        fi
        pid="$(parent_pid "$pid")"
    done
    return 1
}

main() {
    local state panes seen
    state="$(state_file)"
    mkdir -p "$(dirname "$state")"
    : > "$state"

    [ -d "$CLAUDE_SESSIONS_DIR" ] || return 0

    panes="$(mktemp)"
    seen="$(mktemp)"
    tmux list-panes -a -F "#{pane_pid}${TAB}#{session_name}${TAB}#{window_index}${TAB}#{pane_index}" > "$panes"

    local session_file pid session_id pane
    for session_file in "$CLAUDE_SESSIONS_DIR"/*.json; do
        [ -f "$session_file" ] || continue

        pid="$(session_pid "$session_file")"
        [ -n "$pid" ] || continue
        process_is_running "$pid" || continue

        # Subagents and one-shot runs are not worth reviving in a pane.
        [ "$(session_field kind "$session_file")" = "interactive" ] || continue

        session_id="$(session_field sessionId "$session_file")"
        [ -n "$session_id" ] || continue

        pane="$(pane_for_process "$pid" "$panes")" || continue

        # A pane can only show one session, so keep the first one found.
        grep -qxF "$pane" "$seen" && continue
        echo "$pane" >> "$seen"

        printf '%s\t%s\n' "$pane" "$session_id" >> "$state"
    done

    rm -f "$panes" "$seen"
    return 0
}
main
