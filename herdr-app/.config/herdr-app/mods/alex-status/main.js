import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, focused, theme, home, exec, settings, readTextFile } from "herdr";

// Bottom bar: what the oh-my-posh prompt shows, for the focused pane.
// Left: folder (blue), branch (green, yellow when dirty) + change markers.
// Right: host (yellow), time (flamingo-ish ansi5 / muted).
//
// Right, when the focused pane runs Claude: how full its context is, a circle
// that fills in eighths + "23% 230k/1.0M" (green < 60, yellow < 85, red above).
// Written per terminal by ~/.local/bin/agent_limits_statusline.py.
//
// Markers (p10k-style, one glyph each, count after it):
//   ⇡ ahead  ⇣ behind  + staged  ! modified  ? untracked  ✖ conflicts

function tidy(cwd, machine) {
  if (!cwd) return null;
  const h = machine ? null : home();
  if (h && cwd.toLowerCase().startsWith(h.toLowerCase())) return "~" + cwd.slice(h.length).replace(/\\/g, "/");
  const m = cwd.match(/^(\/home\/[^/]+|\/root)(\/.*)?$/);
  if (m) return "~" + (m[2] ?? "");
  return cwd;
}

function parse(out) {
  const s = { ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0, conflicts: 0 };
  for (const line of out.split("\n")) {
    if (line.startsWith("# branch.ab ")) {
      const [, a, b] = line.match(/\+(\d+) -(\d+)/) ?? [];
      s.ahead = +a || 0; s.behind = +b || 0;
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const xy = line.slice(2, 4);
      if (xy[0] !== ".") s.staged++;
      if (xy[1] !== ".") s.modified++;
    } else if (line.startsWith("u ")) s.conflicts++;
    else if (line.startsWith("? ")) s.untracked++;
  }
  return s;
}

// nf-md-circle_slice_1..8: a circle filled by eighths.
const SLICES = ["\u{F0A9E}", "\u{F0A9F}", "\u{F0AA0}", "\u{F0AA1}", "\u{F0AA2}", "\u{F0AA3}", "\u{F0AA4}", "\u{F0AA5}"];
const kTokens = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`;

const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default class AlexStatus extends View {
  init(_props, cx) {
    this.git = {};      // key -> parsed status
    this.hosts = {};    // machine ("" = local) -> hostname
    this.busy = false;
    this.ctx = {};      // terminal address -> context record
    this.ctxBusy = false;
    this.time = clock();
    cx.timer.every(3000, (cx) => this.refresh(cx));
    cx.timer.every(15000, (cx) => { const n = clock(); if (n !== this.time) { this.time = n; cx.notify(); } });
  }

  target() {
    const f = focused();
    const space = spaces().find(s => s.active);
    const pane = panes().find(p => p.pane === f?.pane) ?? panes().find(p => p.tab === f?.tab && p.focused);
    const machine = space?.machine ?? null;
    const cwd = pane?.cwd ?? f?.cwd ?? space?.folder ?? null;
    const branch = pane?.cwd ? pane.branch : space?.branch;
    const terminal = f?.terminal ?? pane?.terminal ?? null;
    const claude = pane?.app === "claude-code" || pane?.program?.key === "claude";
    return { machine, cwd, branch, terminal, claude, key: `${machine ?? ""}|${cwd}` };
  }

  refresh(cx) {
    const { machine, cwd, branch, terminal, claude, key } = this.target();
    if (claude && terminal && !this.ctxBusy) {
      this.ctxBusy = true;
      cx.spawn(async (cx) => {
        // Remote addresses are "wsl/t10"; that core knows the terminal as "t10".
        const id = terminal.split("/").pop();
        let rec = null;
        try {
          const text = machine
            ? (await exec("sh", ["-c", `cat ~/.cache/agent-limits/context/${id}.json`], { on: machine })).stdout
            : await readTextFile(`${home()}/.cache/agent-limits/context/${id}.json`);
          rec = JSON.parse(text);
        } catch {}
        if (JSON.stringify(rec) !== JSON.stringify(this.ctx[terminal])) { this.ctx[terminal] = rec; cx.notify(); }
        this.ctxBusy = false;
      });
    }
    const hk = machine ?? "";
    if (!(hk in this.hosts)) {
      this.hosts[hk] = machine ?? "";
      cx.spawn(async (cx) => {
        try { const r = await exec("hostname", [], { on: machine }); if (r.code === 0) this.hosts[hk] = r.stdout.trim(); } catch {}
        cx.notify();
      });
    }
    if (!cwd || !branch || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("git", ["--no-optional-locks", "status", "--porcelain=v2", "--branch"], { cwd, on: machine });
        const next = r.code === 0 ? parse(r.stdout) : null;
        if (JSON.stringify(next) !== JSON.stringify(this.git[key])) { this.git[key] = next; cx.notify(); }
      } catch { this.git[key] = null; }
      this.busy = false;
    });
  }

  render(cx) {
    const t = theme();
    const { machine, cwd, branch, terminal, claude, key } = this.target();
    const shown = `${key}|${terminal}`;
    if (shown !== this.shownKey) { this.shownKey = shown; this.refresh(cx); }   // new pane/folder: don't wait 3 s
    const folder = tidy(cwd, machine);
    const g = branch ? this.git[key] : null;
    const dirty = g && (g.staged || g.modified || g.untracked || g.conflicts);
    const branchColor = dirty ? t.ansi3 : t.ansi2;
    const mono = settings().font_family ?? "FiraCode Nerd Font Mono";
    const icon = (name, color) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none().text_color(color);
    const mark = (glyph, n, color) => n ? div().flex_none().text_color(color).child(`${glyph}${n}`) : null;
    const marks = g ? [
      mark("⇡", g.ahead, t.ansi6), mark("⇣", g.behind, t.ansi6),
      mark("+", g.staged, t.ansi2), mark("!", g.modified, t.ansi3),
      mark("?", g.untracked, t.muted), mark("✖", g.conflicts, t.ansi1),
    ].filter(Boolean) : [];
    const host = this.hosts[machine ?? ""];
    const ctx = claude ? this.ctx[terminal] : null;
    const pct = ctx?.used == null ? null : Math.max(0, Math.min(100, ctx.used));
    const ctxColor = pct == null ? t.dim : pct < 60 ? t.ansi2 : pct < 85 ? t.ansi3 : t.ansi1;

    return h_flex().size_full().min_w(0).px(12).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(12)
      .when(Boolean(folder), el => el.child(h_flex().min_w(0).gap(6).items_center()
        .child(icon("folder", t.ansi4)).child(div().min_w(0).truncate().text_color(t.ansi4).child(folder))))
      .when(Boolean(branch), el => el.child(h_flex().flex_none().gap(6).items_center()
        .child(icon("git-branch", branchColor)).child(div().max_w(320).truncate().text_color(branchColor).child(branch))
        .when(marks.length > 0, el => el.child(h_flex().gap(6).items_center().font_family(mono).children(marks)))))
      .child(div().flex_1())
      .when(Boolean(ctx), el => el.child(h_flex().flex_none().gap(5).items_center().font_family(mono)
        .child(div().text_size(14).text_color(ctxColor).child(SLICES[Math.max(0, Math.ceil((pct ?? 0) / 12.5) - 1)]))
        .child(div().text_color(ctxColor).child(pct == null ? "–" : `${Math.round(pct)}%`))
        .when(Boolean(ctx?.tokens), el => el.child(div().text_color(t.dim).child(`${kTokens(ctx.tokens)}/${kTokens(ctx.size)}`)))))
      .when(Boolean(host), el => el.child(div().flex_none().text_color(t.ansi3).child(host)))
      .child(div().flex_none().text_color(t.muted).font_family(mono).child(this.time));
  }
}
