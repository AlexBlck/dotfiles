# Herdr ideas (parked)

Things considered for the `alex-black` layout but not built. Build only when needed.

## Tab names from Claude session names (parked 2026-11-05)

**Why it came up:** the tab picker (`ctrl-shift-s`) showed names that looked inconsistent:
`1`, `brickpilot`, `3`, `vlm-planning`, `1`. Cause: herdr names an unnamed tab by
its position, and a named tab keeps its name forever. The named ones (`mdm`,
`brickpilot`, `vlm-planning`, `explorer`) were set by the agent that moved the
Claude sessions from tmux into herdr, using the tmux window names. Herdr never
names tabs after Claude sessions. Decision: probably fine as is; the oddness is
mostly leftovers from the tmux migration.

**If it becomes needed:**
1. Clear the leftover tmux names: `herdr-app do tab.rename --id <tab> --name ""`
   for `brickpilot`, `vlm-planning`, `mdm`, `explorer`. Otherwise they always win.
2. For tabs nobody named, show the Claude session name instead of the number,
   in both the picker and `alex-tabs`. Order of preference:
   - the name given with `/rename` (Claude's live session record);
   - else the terminal title Claude set (`panes()[i].title`);
   - else the tab number.
   The picker is herdr's `picker` mod: clone it (`mod.clone`) the same way as `tabs`.

**What was verified (2026-11-05):**
- `panes()[i].title` is set by Claude, but it is **stale after `/rename`**:
  the img2brick pane's title stayed `vlm-planning` while its session was named `skypilot`.
- Accurate source (WSL): `~/.claude/sessions/<pid>.json` for running Claudes has
  `name` and `nameSource` (`"user"` = named with `/rename`; `"derived"` = made up
  from the folder, e.g. `ml-dataset-manager-05`; ignore those). Skip files whose
  pid isn't alive: many stale ones are left behind.
- Map a Claude to its herdr terminal via `HC_TERMINAL_ID` in `/proc/<pid>/environ`.
  Do it in a small WSL script the mod runs with `exec(..., { on: "wsl" })` every ~5 s.
- Claudes on Windows: no `/proc`; fall back to the terminal title there.
