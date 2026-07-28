#!/usr/bin/env bash
# ABOUTME: Shared helpers for the Claude Code session save and restore hooks.
# ABOUTME: Locates the state files and reads fields out of Claude session files.

TAB=$'\t'

# Claude Code writes one file per running session, named after its process id.
CLAUDE_SESSIONS_DIR="${CLAUDE_SESSIONS_DIR:-$HOME/.claude/sessions}"
CLAUDE_PROJECTS_DIR="${CLAUDE_PROJECTS_DIR:-$HOME/.claude/projects}"

resurrect_dir() {
    local dir
    dir="$(tmux show-option -gqv @resurrect-dir)"
    dir="${dir:-$HOME/.tmux/resurrect}"
    echo "$dir" | sed "s,\$HOME,$HOME,g; s,~,$HOME,g"
}

# Pane-to-session records, kept next to the tmux-resurrect save files.
state_file() {
    echo "$(resurrect_dir)/claude_sessions.tsv"
}

session_field() {
    local name="$1" file="$2"
    sed -n "s/.*\"$name\":\"\([^\"]*\)\".*/\1/p" "$file"
}

session_pid() {
    sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$1"
}

process_is_running() {
    kill -0 "$1" 2>/dev/null
}

parent_pid() {
    ps -o ppid= -p "$1" 2>/dev/null | tr -d '[:space:]'
}
