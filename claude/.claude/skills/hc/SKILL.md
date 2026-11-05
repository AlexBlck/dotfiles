---
name: hc
description: Run programs and agents in Herdr via `hc` (herdr-core). Use when asked to make a git worktree, open a new Herdr space or tab, or start an agent on a worktree/issue (you can create Herdr spaces yourself, no app or clicking needed); when delegating to sub-agents; when sending context or a task to another agent/space, or receiving one from another agent (`<hc from=...>`); when running anything slow (builds, tests, training, CI watches, servers) without blocking; or when reading/messaging/waiting on terminals. Applies when `$HC_TERMINAL_ID` is set (you are inside Herdr).
---

# hc: terminals and agents that stay alive

You are running inside herdr-core when `$HC_TERMINAL_ID` is set (your own
terminal address). Terminals you start with `hc run` are your children: Herdr
shows them under you in its agents list, and the user can peek at or take
over any of them.

**Before your first hc command in a session, run `hc --skill` and read it.**
It is the current manual for this installed version; prefer it over anything
below if they disagree.

## When to reach for it

- **Delegate**: one sub-agent per independent task, e.g. one Claude per issue
  in its own git worktree (`git worktree add ~/.herdr/worktrees/<repo>/<branch> -b <branch>`):
  `hc run --bg --cwd <worktree> --name gh-66 claude "<task>"`, then
  `hc wait --children any`, `hc read gh-66 --lines 60`.
- **Anything slow** (tests, builds, `uv run` training jobs, `gh run watch`):
  `hc run --bg --name tests <cmd>` then `hc wait tests` instead of blocking
  your own shell tool or sleeping.
- **Servers**: `hc run --bg --name web <cmd>`; read its output with `hc read`.

## Open a Herdr space or tab yourself (worktrees too)

Herdr shows any terminal labelled `herdr.space=<id>` and `herdr.tab=<id>`; an
id it hasn't seen becomes a new space or tab. Use that instead of asking the
user to click. New ids: `sp`/`tb` + 32 hex chars.

```sh
new() { printf '%s%s' "$1" "$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"; }
# a worktree as its own space (Herdr nests it under the repo by itself)
git -C ~/projects/<repo> worktree add ~/.herdr/worktrees/<repo>/<branch> -b <branch>
hc run --bg --keep --outlive-parent --cwd ~/.herdr/worktrees/<repo>/<branch> --label herdr.space="$(new sp)" --label herdr.tab="$(new tb)" -- claude "<task>"
# a new tab in your own space: reuse your space id
me_space=$(hc get "$HC_TERMINAL_ID" --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["labels"]["herdr.space"])')
hc run --bg --keep --outlive-parent --cwd <dir> --label herdr.space="$me_space" --label herdr.tab="$(new tb)" -- claude "<task>"
```

- Name worktrees by topic only, never with the repo name: Herdr names the
  space after the worktree's folder and already nests it under the repo, so
  `ai-training` gets a `v2-census` space, not `ai-training-v2-census`. Use the
  short name for the folder (`~/.herdr/worktrees/ai-training/v2-census`) and,
  unless the repo has its own branch convention (`feature/...`), for the
  branch too. With a prefixed branch, keep the folder short anyway:
  `git worktree add ~/.herdr/worktrees/<repo>/v2-census feature/v2-census`.
  Don't fix names afterwards with `space.rename`: a renamed space stops
  following its folder.
- Branch already exists: `git worktree add ~/.herdr/worktrees/<repo>/<branch> <branch>`
  (no `-b`). Worktree already exists (`git worktree list`): skip straight to
  `hc run` in its folder. Repo name = the main checkout's folder name.
- `--outlive-parent`: without it the space's terminal ends when you do.
- `--keep`: herdr-core recovers it after a crash, like Herdr's own panes.
- When that program exits, its pane closes (the space too if it was the
  only one). Wrap it to leave a shell behind:
  `-- /home/alex/.nix-profile/bin/zsh -lic 'claude "<task>"; exec zsh -l'`.
- Opening a space this way does not switch the user's window to it. Tell the
  user its name instead.
- To remove a worktree you made: `hc kill` its terminals, then
  `git worktree remove <path>` and `git branch -d <branch>`. Never remove
  worktrees or branches you didn't create.

## Where a worker goes: space, tab, pane, or none

One space = one checkout (Herdr shows its branch, changes and files). Pick the
lightest level that fits:

| The worker... | Put it |
|---|---|
| changes code on its own branch | its own worktree space (label recipe above): one tab, one pane |
| is a short job in your checkout: review, test run, research, lookup | plain sub-agent: `hc run --bg --cwd <your checkout> ...`, no labels. It shows under you in the agents list; the user can peek |
| runs alongside in the same checkout for a while: server, watch-mode tests, a second conversation on this branch | a new named tab in your space (label recipe, your space id) |
| is something the user should watch next to you | `herdr-app do terminal.keep '{"terminal":"wsl/<t>","place":"right"}'` |

- Never put two writers in one checkout: a second agent that edits files gets
  a worktree, not a tab.
- Don't open a space for every helper. The sidebar should list real branches.
- Name tabs for what runs in them (`server`, `tests`, `review`); unnamed tabs
  show as numbers.
- When a worker's branch is merged or abandoned, clean up only what you made:
  kill its terminals (the space closes with them), remove its worktree.

## Handing work to another agent

When the user tells you to pass context or a task to another agent ("send
this to the ml-dataset-manager space, tell it to prep X"), it's a handoff:
the recipient owns the task from then on, and the user talks to it directly.

- **Sender**: send everything the recipient needs in one message (`hc send
  <t> "..."`; find the agent with `hc ls` / `herdr-app ls`), and say it's a
  handoff from the user: "The user asked me to hand this to you. Ask the
  user any questions in your own session, not me." Then stop; don't wait on
  it or relay its questions. Tell the user which space/terminal it went to.
- **Recipient**: if a message from another agent (`<hc from=...>`) hands you
  a task from the user, treat it as the user's request. Ask follow-up
  questions in your own session (end your turn with the question; Herdr
  shows you as needing an answer) and wait for the user. Do not send the
  questions back to the sender.
- Back-and-forth between agents is still fine when it's the actual job:
  you delegated a sub-task to your own child, or the user asked the agents
  to work something out together. Reporting results back when the user
  asked you to is fine too.

## Rules

- Use `hc wait`, never `sleep`, to wait for a terminal.
- Always pass `--cwd` for a child Claude: the repo or worktree it works in.
  Never start one in `~` (/home/alex): Claude never remembers trust for the
  home folder, so the child stops at "trust this folder?" every time, and
  `hc wait` does not report that as blocked.
- A brand-new worktree folder also asks once. If a child stays `working`
  with no output for over a minute, `hc read` it. A trust or permission
  prompt is the user's to answer: tell them which terminal (e.g. `wsl/t15`)
  and keep doing other work; never press it yourself.
- A child `blocked` means it needs a person (permission or a question): tell
  the user rather than bypassing it.
- Only clean up terminals you started (`hc kill <t>`, `hc rm <t>`); `hc ls`
  also shows the user's own work.
- Never `hc server stop`/`restart` unless the user asks: it affects every
  terminal.

## This machine

- herdr-core runs inside WSL (Ubuntu-24.04), added to the Windows Herdr app as
  machine `wsl`. Paths are Linux paths (`/home/alex/projects/...`).
- Worktrees go where Herdr puts them: `~/.herdr/worktrees/<repo>/<branch>`
  (Herdr shows each as a space nested under its repo). Do not create sibling
  `~/projects/<repo>-<topic>` folders; older ones exist but are not a convention.
- The Herdr window runs on Windows; `herdr-app` (a wrapper in ~/.local/bin)
  drives it from here. Do NOT tell the user to click "Open worktree" or "New
  space": create spaces and tabs yourself with labels (section above), not
  with `herdr-app do space.new/tab.new`, which switch the user's window to the
  new thing and, from WSL, default to the Windows machine unless
  `"machine":"wsl"` is passed.
- Use `herdr-app` for what labels can't do, on spaces/tabs you made:
  `herdr-app ls` / `status` (read state; ids from WSL show as `wsl/...`),
  `herdr-app do tab.rename '{"id":"wsl/tb...","name":"gh-66"}'`,
  `space.rename`, `tab.close` / `space.close` (with `"confirmed":true`),
  `terminal.keep` (give a sub-agent a pane). `herdr-app commands` lists all.
  Never close, rename or rearrange the user's own spaces and tabs.
