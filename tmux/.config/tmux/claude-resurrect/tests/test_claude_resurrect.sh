#!/usr/bin/env bash
# ABOUTME: Tests the Claude Code session save and restore hooks for tmux-resurrect.
# ABOUTME: Drives a real tmux server on an isolated socket with a stub claude on PATH.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_DIR="$(dirname "$SCRIPT_DIR")"

SOCKET="claude-resurrect-test"
REAL_TMUX="$(command -v tmux)"

WORK_DIR="$(mktemp -d)"
RESURRECT_DIR="$WORK_DIR/resurrect"
STATE_FILE="$RESURRECT_DIR/claude_sessions.tsv"
STUB_DIR="$WORK_DIR/bin"
CLAUDE_LOG="$WORK_DIR/claude_invocations.txt"
BUSY_STDIN="$WORK_DIR/busy_pane_stdin.txt"

export CLAUDE_SESSIONS_DIR="$WORK_DIR/sessions"
export CLAUDE_PROJECTS_DIR="$WORK_DIR/projects"

ID_LIVE="11111111-1111-1111-1111-111111111111"
ID_DEAD="22222222-2222-2222-2222-222222222222"
ID_AGENT="33333333-3333-3333-3333-333333333333"
ID_BUSY="44444444-4444-4444-4444-444444444444"
ID_MISSING="55555555-5555-5555-5555-555555555555"

failures=0

pass() {
    printf 'ok   %s\n' "$1"
}

fail() {
    printf 'FAIL %s\n' "$1"
    failures=$((failures + 1))
}

assert_contains() {
    local file="$1" needle="$2" message="$3"
    if [ -f "$file" ] && grep -qF -- "$needle" "$file"; then
        pass "$message"
    else
        fail "$message (expected '$needle' in $file)"
        [ -f "$file" ] && printf '     actual: %s\n' "$(cat "$file")"
    fi
}

assert_lacks() {
    local file="$1" needle="$2" message="$3"
    if [ ! -f "$file" ] || ! grep -qF -- "$needle" "$file"; then
        pass "$message"
    else
        fail "$message (unexpected '$needle' in $file)"
        printf '     actual: %s\n' "$(cat "$file")"
    fi
}

write_session_file() {
    local pid="$1" session_id="$2" kind="$3" cwd="$4"
    printf '{"pid":%s,"sessionId":"%s","cwd":"%s","kind":"%s","status":"idle"}\n' \
        "$pid" "$session_id" "$cwd" "$kind" > "$CLAUDE_SESSIONS_DIR/${pid}.json"
}

write_conversation_file() {
    local session_id="$1"
    mkdir -p "$CLAUDE_PROJECTS_DIR/-tmp-project"
    printf '{}\n' > "$CLAUDE_PROJECTS_DIR/-tmp-project/${session_id}.jsonl"
}

# The pid of the process a pane is running, i.e. the pane shell's child.
pane_child_pid() {
    local window="$1"
    local pane_pid
    pane_pid="$("$REAL_TMUX" -L "$SOCKET" display-message -p -t "testsess:${window}.0" '#{pane_pid}')"
    pgrep -P "$pane_pid" | head -1
}

wait_for_command() {
    local window="$1" expected="$2" attempts=50
    while [ "$attempts" -gt 0 ]; do
        if [ "$("$REAL_TMUX" -L "$SOCKET" display-message -p -t "testsess:${window}.0" '#{pane_current_command}')" = "$expected" ]; then
            return 0
        fi
        sleep 0.1
        attempts=$((attempts - 1))
    done
    return 1
}

wait_for_file() {
    local file="$1" attempts=50
    while [ "$attempts" -gt 0 ]; do
        [ -s "$file" ] && return 0
        sleep 0.1
        attempts=$((attempts - 1))
    done
    return 1
}

cleanup() {
    "$REAL_TMUX" -L "$SOCKET" kill-server 2>/dev/null
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

setup() {
    mkdir -p "$CLAUDE_SESSIONS_DIR" "$CLAUDE_PROJECTS_DIR" "$RESURRECT_DIR" "$STUB_DIR"

    # A tmux on PATH that always talks to the test server, so the hooks under
    # test need no knowledge of the socket.
    cat > "$STUB_DIR/tmux" <<EOF
#!/usr/bin/env bash
exec "$REAL_TMUX" -L "$SOCKET" "\$@"
EOF

    # Stand-in for Claude Code: records how it was invoked and exits.
    cat > "$STUB_DIR/claude" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$CLAUDE_LOG"
EOF

    chmod +x "$STUB_DIR/tmux" "$STUB_DIR/claude"
    export PATH="$STUB_DIR:$PATH"

    # Panes run a shell without rc files so the stub claude stays ahead on PATH.
    local pane_shell='bash --noprofile --norc'
    "$REAL_TMUX" -L "$SOCKET" -f /dev/null new-session -d -s testsess -c "$WORK_DIR" "$pane_shell"
    local window
    for window in 1 2 3 4; do
        "$REAL_TMUX" -L "$SOCKET" new-window -d -t "testsess:$window" -c "$WORK_DIR" "$pane_shell"
    done
    "$REAL_TMUX" -L "$SOCKET" set-option -g @resurrect-dir "$RESURRECT_DIR"

    # Windows 0 and 2 hold a long-running process standing in for claude.
    # Window 0 records anything typed at it, so a pane that should have been
    # left alone cannot swallow the evidence.
    "$REAL_TMUX" -L "$SOCKET" send-keys -t testsess:0.0 "cat > $BUSY_STDIN" C-m
    "$REAL_TMUX" -L "$SOCKET" send-keys -t testsess:2.0 'sleep 600' C-m
    wait_for_command 0 cat || { echo "setup failed: window 0 never ran cat"; exit 1; }
    wait_for_command 2 sleep || { echo "setup failed: window 2 never ran sleep"; exit 1; }
}

test_save() {
    local live_pid agent_pid dead_pid
    live_pid="$(pane_child_pid 0)"
    agent_pid="$(pane_child_pid 2)"
    bash -c 'exit 0' &
    dead_pid=$!
    wait "$dead_pid" 2>/dev/null

    write_session_file "$live_pid" "$ID_LIVE" interactive "$WORK_DIR"
    write_session_file "$agent_pid" "$ID_AGENT" agent "$WORK_DIR"
    write_session_file "$dead_pid" "$ID_DEAD" interactive "$WORK_DIR"

    "$HOOK_DIR/save.sh"

    assert_contains "$STATE_FILE" "$(printf 'testsess\t0\t0\t%s' "$ID_LIVE")" \
        "save records the pane running an interactive session"
    assert_lacks "$STATE_FILE" "$ID_AGENT" "save skips non-interactive sessions"
    assert_lacks "$STATE_FILE" "$ID_DEAD" "save skips sessions whose process has exited"
}

test_restore() {
    write_conversation_file "$ID_LIVE"
    write_conversation_file "$ID_BUSY"

    {
        printf 'testsess\t3\t0\t%s\n' "$ID_LIVE"
        printf 'testsess\t0\t0\t%s\n' "$ID_BUSY"
        printf 'testsess\t4\t0\t%s\n' "$ID_MISSING"
    } > "$STATE_FILE"

    "$HOOK_DIR/restore.sh"

    if wait_for_file "$CLAUDE_LOG"; then
        assert_contains "$CLAUDE_LOG" "--resume $ID_LIVE" \
            "restore resumes the saved session in an idle pane"
    else
        fail "restore resumes the saved session in an idle pane (claude was never invoked)"
    fi

    assert_lacks "$BUSY_STDIN" "$ID_BUSY" "restore skips panes already running a process"
    assert_lacks "$CLAUDE_LOG" "$ID_MISSING" "restore skips sessions with no conversation on disk"
}

main() {
    setup
    test_save
    test_restore

    if [ "$failures" -gt 0 ]; then
        printf '\n%s test(s) failed\n' "$failures"
        exit 1
    fi
    printf '\nall tests passed\n'
}
main
