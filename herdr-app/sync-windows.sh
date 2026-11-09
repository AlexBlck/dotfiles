#!/usr/bin/env bash
# Sync the herdr-app package with the Windows herdr config (herdr's window runs on Windows).
#
#   ./sync-windows.sh pull   Windows -> repo (before committing)
#   ./sync-windows.sh push   repo -> Windows (after pulling the repo on a new machine)
#
# Only the files we own are synced: the alex-black layout, our themes and mods,
# keys/settings, IDEAS.md, and the Claude statusLine script that feeds the limit
# bars and context gauge. Herdr's shipped files and generated state are left out.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
win_home="${WIN_HOME:-/mnt/c/Users/$(cmd.exe /c 'echo %USERNAME%' </dev/null 2>/dev/null | tr -d '\r')}"
win_cfg="$win_home/.config/herdr-app"
win_bin="$win_home/.local/bin"
repo_cfg="$here/.config/herdr-app"
repo_bin="$here/.local/bin"

# Paths relative to the herdr-app config folder.
files=(keys.json settings.json IDEAS.md layouts/alex-black.json)
mods=(alex-agents alex-chrome alex-spaces alex-status alex-tabs theme-picker)
# Herdr ships these themes itself; everything else in themes/ is ours.
shipped_themes=(atom-one-dark.json win98.json)

copy_tree() { # src dst
  local src="$1" dst="$2" f m t
  mkdir -p "$dst/layouts" "$dst/themes" "$dst/mods"
  for f in "${files[@]}"; do cp "$src/$f" "$dst/$f"; done
  for m in "${mods[@]}"; do
    rsync -a --delete --exclude gpui-kit.d.ts --exclude jsconfig.json "$src/mods/$m/" "$dst/mods/$m/"
  done
  local excl=()
  for t in "${shipped_themes[@]}"; do excl+=(--exclude "$t"); done
  rsync -a --delete "${excl[@]}" "$src/themes/" "$dst/themes/"
}

# Files edited in the repo since Windows last changed them: a pull would undo those edits.
repo_ahead() {
  local f rel
  while IFS= read -r f; do
    rel="${f#"$repo_cfg"/}"
    [ -f "$win_cfg/$rel" ] && [ "$f" -nt "$win_cfg/$rel" ] && ! cmp -s "$f" "$win_cfg/$rel" && echo "  $rel"
  done < <(find "$repo_cfg" -type f)
  return 0
}

case "${1:-}" in
  pull)
    ahead="$(repo_ahead)"
    if [ -n "$ahead" ] && [ -z "${FORCE:-}" ]; then
      echo "These repo files are newer than the Windows copies; pull would undo them:" >&2
      echo "$ahead" >&2
      echo "Run 'push' first (or FORCE=1 to overwrite them)." >&2
      exit 1
    fi
    copy_tree "$win_cfg" "$repo_cfg"
    mkdir -p "$repo_bin" && cp "$win_bin/agent_limits_statusline.py" "$repo_bin/"
    # Files copied off the Windows drive come out executable; keep git modes normal.
    find "$repo_cfg" -type f -exec chmod 644 {} +
    # Windows editors write CRLF; keep the repo LF.
    find "$repo_cfg" "$repo_bin" -type f \( -name "*.js" -o -name "*.json" -o -name "*.svg" -o -name "*.md" -o -name "*.py" \) -exec sed -i 's/\r$//' {} +
    chmod 755 "$repo_bin/agent_limits_statusline.py"
    ;;
  push)
    copy_tree "$repo_cfg" "$win_cfg"
    mkdir -p "$win_bin" && cp "$repo_bin/agent_limits_statusline.py" "$win_bin/"
    ;;
  *) echo "usage: $0 pull|push" >&2; exit 1 ;;
esac
echo "$1 done"
