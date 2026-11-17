// Markdown viewer. Two faces of one mod:
// - opened with a key (mod.open:md-viewer): a fuzzy picker over the .md files under
//   the focused pane's folder (on its machine). Enter opens the file in a pane on
//   the right and gives the keyboard back to the terminal.
// - as a pane (props: { file, on }): the file rendered, re-read when it changes.
//   Relative links to other .md files open in the same pane.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { run, theme, props, closeOverlay, spaces, panes, focused, exec, readTextFile, window, settings } from "herdr";

const MAX_FILES = 3000, ROWS = 14, POLL_MS = 1500;
const SKIP = ["node_modules", ".git", ".venv", "venv", "target", "dist", "build", "__pycache__", ".cache"];

// Where the focused pane is: its folder and machine (as the Files panel works it out).
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, pane: f?.pane ?? null };
}

async function mdFiles(root, on) {
  if (!on && window()?.platform === "windows") {
    const skip = SKIP.map((s) => `'${s}'`).join(",");
    const ps = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) $skip=@(${skip}); `
      + `Get-ChildItem -LiteralPath $p -Recurse -Depth 6 -File -Filter *.md -ErrorAction SilentlyContinue | `
      + `Where-Object { -not ($_.FullName.Substring($p.Length).Split([IO.Path]::DirectorySeparatorChar) | Where-Object { $skip -contains $_ }) } | `
      + `Select-Object -First ${MAX_FILES} | ForEach-Object { $_.FullName.Substring($p.Length).TrimStart('\\').Replace('\\','/') } } '${root.replace(/'/g, "''")}'`;
    const r = await exec("powershell", ["-NoProfile", "-Command", ps]);
    return r.stdout.split(/\r?\n/).filter(Boolean);
  }
  const prune = SKIP.map((s) => `-name '${s}'`).join(" -o ");
  const script = `cd "$1" && find . -maxdepth 7 \\( ${prune} \\) -prune -o -type f \\( -iname '*.md' -o -iname '*.markdown' \\) -print 2>/dev/null | head -n ${MAX_FILES}`;
  const r = await exec("sh", ["-c", script, "md", root], { on });
  return r.stdout.split("\n").filter(Boolean).map((p) => p.replace(/^\.\//, ""));
}

// Subsequence match on the path: lower is better, null when it doesn't match.
// Word starts (after / - _ . or a space) and runs score well, and so does the file name.
function fuzzy(query, path) {
  const q = query.toLowerCase().replace(/\s+/g, ""), s = path.toLowerCase();
  if (!q) return 0;
  const base = s.lastIndexOf("/") + 1;
  let score = 0, at = -1;
  for (const c of q) {
    const i = s.indexOf(c, at + 1);
    if (i < 0) return null;
    const start = i === 0 || "/-_. ".includes(s[i - 1]);
    score += (i - at - 1) * (at < 0 ? 0.1 : 1) - (start ? 3 : 0) - (i === at + 1 ? 2 : 0) - (i >= base ? 1 : 0);
    at = i;
  }
  return score + s.length * 0.02;
}

const dirname = (p) => p.replace(/[\\/][^\\/]*$/, "");
const basename = (p) => p.split(/[\\/]/).pop();
function resolve(dir, rel) {
  const parts = (rel.startsWith("/") ? rel : `${dir}/${rel}`).split("/");
  const out = [];
  for (const p of parts) { if (p === "..") out.pop(); else if (p !== "." && (p || !out.length)) out.push(p); }
  return out.join("/") || "/";
}

export default class MdViewer extends View {
  init(_p, cx) {
    const p = props() ?? {};
    if (p?.file) return this.initViewer(p, cx);
    this.picker = true;
    this.loc = location();
    this.files = null;
    this.error = null;
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.input = InputState.new({ placeholder: "Markdown file…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", () => this.open(this.list()[this.at]));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    cx.spawn(async (cx) => {
      try {
        if (!this.loc.cwd) throw new Error("No folder for the focused pane");
        this.files = (await mdFiles(this.loc.cwd, this.loc.on))
          .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
      } catch (e) { this.error = String(e?.message ?? e); this.files = []; }
      cx.notify();
    });
  }

  list() {
    if (!this.files) return [];
    if (!this.filter) return this.files;
    return this.files.map((f) => ({ f, s: fuzzy(this.filter, f) })).filter((x) => x.s !== null)
      .sort((a, b) => a.s - b.s).map((x) => x.f);
  }

  open(rel) {
    if (!rel) return;
    const { cwd, on, pane } = this.loc;
    const sep = !on && window()?.platform === "windows" && cwd.includes("\\") ? "\\" : "/";
    const file = `${cwd.replace(/[\\/]$/, "")}${sep}${sep === "\\" ? rel.replace(/\//g, "\\") : rel}`;
    closeOverlay(props().overlay);
    run("pane.split", { direction: "right", ...(pane ? { pane } : {}), mod: "md-viewer", props: { file, on } });
    if (pane) run("pane.focus", { pane });
  }

  // ---- viewer ----

  initViewer(p, cx) {
    this.picker = false;
    this.file = p.file;
    this.on = p.on ?? null;
    this.text = null;
    this.error = null;
    this.load(cx);
    cx.timer.every(POLL_MS, (cx) => this.load(cx));
  }

  load(cx) {
    if (this.loading) return;
    this.loading = true;
    const file = this.file;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(file, { on: this.on });
        if (file !== this.file) return;
        const error = text === null ? "This file is no longer there" : null;
        if (text !== this.text || error !== this.error) { this.text = text; this.error = error; cx.notify(); }
      } catch (e) {
        if (file === this.file && !this.error) { this.error = String(e?.message ?? e); cx.notify(); }
      } finally { this.loading = false; }
    });
  }

  follow(url, cx) {
    if (/^https?:\/\//i.test(url)) return cx.open_url(url);
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return;
    const path = decodeURIComponent(url.split("#")[0]);
    if (!path || !/\.(md|markdown)$/i.test(path)) return;
    this.file = resolve(dirname(this.file).replace(/\\/g, "/"), path);
    this.text = null; this.error = null; this.loading = false;
    this.load(cx);
    cx.notify();
  }

  render() {
    return this.picker ? this.renderPicker() : this.renderViewer();
  }

  renderViewer() {
    const t = theme();
    const name = basename(this.file);
    return v_flex().id("md-root").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .child(h_flex().h(30).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border).text_size(12)
        .child(div().flex_none().font_semibold().child(name))
        .child(div().flex_1().min_w(0).truncate().text_right().text_color(t.dim).child(`${this.on ? this.on + ":" : ""}${dirname(this.file)}`)))
      .child(this.error || this.text === null
        ? div().p(16).text_size(13).text_color(t.dim).child(this.error ?? "Loading…")
        : div().id("md-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(20).py(14).text_size(14)
          .child(TextView.markdown("md-body", this.text).selectable(true)
            .on_link_click((url, cx) => this.follow(url, cx))));
  }

  renderPicker() {
    const t = theme();
    const list = this.list();
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    if (this.at < this.scroll) this.scroll = this.at;
    if (this.at >= this.scroll + ROWS) this.scroll = this.at - ROWS + 1;
    const shown = list.slice(this.scroll, this.scroll + ROWS);
    const move = (d, cx) => {
      if (!list.length) return;
      this.at = Math.max(0, Math.min(list.length - 1, this.at + d));
      cx.notify();
    };
    const row = (rel, i) => {
      const on = i === this.at, slash = rel.lastIndexOf("/");
      return h_flex().id(`md-${rel}`).h(28).flex_none().px(10).gap(8).items_center().rounded(6).cursor_pointer()
        .when(on, (el) => el.bg(t.selected))
        .on_click(() => this.open(rel))
        .child(div().flex_none().text_color(on ? t.foreground : t.muted).child(rel.slice(slash + 1)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(slash > 0 ? rel.slice(0, slash) : ""));
    };
    const status = this.files === null ? "Looking for markdown files…" : this.error ?? (list.length ? null : "No markdown files here");
    return v_flex().id("md-picker").w_full().min_h(0).p(14).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key, ctrl = e.modifiers.control;
        if (k === "escape") { closeOverlay(props().overlay); return; }
        if (k === "down" || (ctrl && (k === "j" || k === "n"))) move(1, cx);
        else if (k === "up" || (ctrl && (k === "k" || k === "p"))) move(-1, cx);
        else if (k === "pagedown") move(ROWS, cx);
        else if (k === "pageup") move(-ROWS, cx);
        else return;
        cx.stop_propagation();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(14).font_semibold().text_color(t.foreground).child("Markdown"))
        .child(div().min_w(0).truncate().text_size(11).text_color(t.dim)
          .child(`${this.files ? list.length + " · " : ""}${this.loc.on ? this.loc.on + ":" : ""}${this.loc.cwd ?? ""}`)))
      .child(h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .child(v_flex().id("md-list").gap(2)
        .on_scroll_wheel((e, cx) => { move(e.delta.y < 0 ? 1 : e.delta.y > 0 ? -1 : 0, cx); })
        .when(Boolean(status), (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child(status)))
        .children(shown.map((rel, k) => row(rel, this.scroll + k))));
  }
}
