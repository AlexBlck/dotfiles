#!/usr/bin/env python3
"""Claude Code statusLine command: saves plan usage limits for the herdr sidebar.

Reads the statusLine JSON on stdin and, when it carries `rate_limits`
(5-hour and weekly windows), writes them to ~/.cache/agent-limits/claude.json
together with the logged-in account, so herdr's `alex-chrome` footer can show
them. Also writes the session's context fill to
~/.cache/agent-limits/context/<HC_TERMINAL_ID>.json for herdr's `alex-status`
bar. Prints nothing, so Claude Code's own UI is unchanged.
"""
import json
import os
import sys
import time

home = os.path.expanduser("~")
out_dir = os.path.join(home, ".cache", "agent-limits")
out = os.path.join(out_dir, "claude.json")

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

def write_json(path, obj):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f)
        os.replace(tmp, path)
    except Exception:
        pass


# Context fill for this session, keyed by the herdr terminal it runs in
# (HC_TERMINAL_ID is inherited from the terminal), for the alex-status bar.
terminal = os.environ.get("HC_TERMINAL_ID")
ctx = data.get("context_window") or {}
if terminal and isinstance(ctx, dict) and ctx.get("context_window_size"):
    usage = ctx.get("current_usage") or {}
    tokens = sum(usage.get(k) or 0 for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
    write_json(os.path.join(out_dir, "context", terminal + ".json"), {
        "terminal": terminal,
        "session": data.get("session_id"),
        "used": ctx.get("used_percentage"),
        "tokens": tokens,
        "size": ctx.get("context_window_size"),
        "updated": int(time.time()),
    })

limits = data.get("rate_limits") or {}
windows = {k: limits[k] for k in ("five_hour", "seven_day") if isinstance(limits.get(k), dict)}
if not windows:
    sys.exit(0)

account = {}
try:
    with open(os.path.join(home, ".claude.json"), encoding="utf-8") as f:
        a = json.load(f).get("oauthAccount") or {}
    account = {"id": a.get("accountUuid"), "org": a.get("organizationName"), "email": a.get("emailAddress")}
except Exception:
    pass

# Keep a window this update left out (or reported behind) from the last record,
# as long as that window hasn't reset yet: later reset wins, else higher use.
current = {k: {"used": v.get("used_percentage"), "resets_at": v.get("resets_at")} for k, v in windows.items()}
try:
    with open(out, encoding="utf-8") as f:
        old = json.load(f)
    now = time.time()
    for k in ("five_hour", "seven_day"):
        o = old.get(k)
        if not isinstance(o, dict) or not o.get("resets_at") or o["resets_at"] <= now:
            continue
        c = current.get(k)
        if (c is None or not c.get("resets_at") or o["resets_at"] > c["resets_at"]
                or (o["resets_at"] == c["resets_at"] and (o.get("used") or 0) > (c.get("used") or 0))):
            current[k] = o
except Exception:
    pass

record = {
    "tool": "claude",
    "account": account,
    "updated": int(time.time()),
    **current,
}

write_json(out, record)
