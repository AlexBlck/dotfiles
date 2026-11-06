// Dark theme switcher, Monkeytype-style. Opened with a key (mod.open:theme-picker).
// Monkeytype-style grid: each tile in its theme's background, the name in its accent.
// Type to fuzzy-filter, arrows (or ctrl+h/j/k/l, ctrl+n/p) to move: every move applies
// the theme to the whole window at once. Enter (or a click) keeps it; Esc or
// clicking away puts the theme you had back.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, theme, themes, settings, props, closeOverlay } from "herdr";

const COLS = 3, TILE_H = 30, GAP = 6, ROWS = 10;

// Subsequence match: lower is better, null when the letters aren't all there in order.
// Rewards matches at word starts and runs of consecutive letters.
function fuzzy(query, name) {
  if (!query) return 0;
  const q = query.toLowerCase().replace(/\s+/g, ""), s = name.toLowerCase();
  let score = 0, at = -1;
  for (const c of q) {
    const i = s.indexOf(c, at + 1);
    if (i < 0) return null;
    const wordStart = i === 0 || s[i - 1] === "-";
    score += (i - at - 1) * (at < 0 ? 0.2 : 1) - (wordStart ? 3 : 0) - (i === at + 1 ? 2 : 0);
    at = i;
  }
  return score + s.length * 0.01;
}

// The tile's name color: the theme's most vivid color that still reads on its background
// (herdr's derived accent is blue for most themes, which makes them look alike).
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const sat = (h) => { const v = rgb(h), mx = Math.max(...v), mn = Math.min(...v); return mx === 0 ? 0 : (mx - mn) / mx; };
function mainColor(c) {
  const picks = [c.accent, c.ansi5, c.ansi4, c.ansi6, c.ansi2, c.ansi3, c.ansi1, c.ansi13, c.ansi12, c.ansi14].filter((x) => /^#[0-9a-f]{6}/i.test(x ?? ""));
  let best = c.foreground, score = -1;
  for (const x of picks) {
    const k = contrast(x, c.background);
    const s = sat(x) * Math.min(1, k / 4.5);
    if (s > score + 0.05) { best = x; score = s; }
  }
  return best;
}

export default class ThemePicker extends View {
  init(_props, cx) {
    this.original = settings().theme ?? null;
    this.applied = this.original;
    this.kept = false;
    this.filter = "";
    this.at = null;
    this.scroll = 0;
    this.input = InputState.new({ placeholder: "Theme…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; this.preview(); cx.notify(); });
    this.input.on("submit", () => this.keep());
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
  }

  list() {
    const dark = themes().filter((t) => !t.light);
    // Like Monkeytype: brightest background first, darkest last.
    if (!this.filter) return dark.slice().sort((a, b) => lum(b.colors.background) - lum(a.colors.background));
    return dark.map((t) => ({ t, s: fuzzy(this.filter, t.name) })).filter((x) => x.s !== null)
      .sort((a, b) => a.s - b.s).map((x) => x.t);
  }

  preview() {
    const name = this.list()[this.at]?.name;
    if (name && name !== this.applied) { this.applied = name; run("app.theme", { name }); }
  }

  keep() {
    this.kept = true;
    closeOverlay(props().overlay);
  }

  close() {
    if (!this.kept && this.original && this.applied !== this.original) run("app.theme", { name: this.original });
  }


  render() {
    const t = theme();
    const list = this.list();
    if (this.at === null) this.at = Math.max(0, list.findIndex((x) => x.name === this.original));
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    // this.scroll is the first grid row shown; keep the selected tile's row in view.
    const rowsTotal = Math.ceil(list.length / COLS), maxScroll = Math.max(0, rowsTotal - ROWS);
    const atRow = Math.floor(this.at / COLS);
    if (atRow < this.scroll) this.scroll = atRow;
    if (atRow >= this.scroll + ROWS) this.scroll = atRow - ROWS + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const gridRows = [];
    for (let r = this.scroll; r < Math.min(rowsTotal, this.scroll + ROWS); r++) gridRows.push(r);

    const move = (d, cx) => {
      if (!list.length) return;
      const next = this.at + d;
      // Left/right wrap through the list; up/down stop at the edges.
      this.at = Math.abs(d) === 1 ? (next + list.length) % list.length : Math.max(0, Math.min(list.length - 1, next));
      this.preview();
      cx.notify();
    };

    // A tile in the theme's own colors. The selected one gets an outline in its text
    // color and three dots (accent, text, red); the theme you opened with is underlined.
    const tile = (th, i) => {
      const c = th.colors, on = i === this.at;
      const dot = (color) => div().size(7).rounded(4).bg(color);
      return h_flex().id(`th-${th.name}`).flex_1().min_w(0).h(TILE_H).px(8).gap(6).items_center().justify_center()
        .rounded(6).bg(c.background).border_2().border_color(on ? c.foreground : c.background).cursor_pointer()
        .on_click(() => { this.at = i; this.preview(); this.keep(); })
        .child(div().min_w(0).truncate().text_color(mainColor(c)).when(th.name === this.original, (d) => d.underline()).child(th.name))
        .when(on, (el) => el.child(h_flex().flex_none().gap(3).child(dot(mainColor(c))).child(dot(c.foreground)).child(dot(c.ansi1))));
    };
    const filler = (k) => div().id(`th-fill-${k}`).flex_1().h(TILE_H);

    return v_flex().id("theme-picker").w_full().min_h(0).p(14).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key, ctrl = e.modifiers.control;
        if (k === "escape") { closeOverlay(props().overlay); return; }
        if (k === "right" || (ctrl && (k === "l" || k === "n"))) move(1, cx);
        else if (k === "left" || (ctrl && (k === "h" || k === "p"))) move(-1, cx);
        else if (k === "down" || (ctrl && k === "j")) move(COLS, cx);
        else if (k === "up" || (ctrl && k === "k")) move(-COLS, cx);
        else if (k === "pagedown") move(COLS * ROWS, cx);
        else if (k === "pageup") move(-COLS * ROWS, cx);
        else return;
        cx.stop_propagation();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(14).font_semibold().text_color(t.foreground).child("Theme"))
        .child(div().text_size(11).text_color(t.dim).child(`${list.length} · Enter keeps · Esc reverts`)))
      .child(h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(14).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .child(v_flex().id("th-grid").gap(GAP).overflow_hidden()
        .on_scroll_wheel((e, cx) => {
          const step = e.delta.y < 0 ? 1 : e.delta.y > 0 ? -1 : 0;
          this.scroll = Math.max(0, Math.min(this.scroll + step, maxScroll));
          // The selection follows the wheel so the next frame doesn't scroll back.
          const r = Math.floor(this.at / COLS);
          if (r < this.scroll) this.at += (this.scroll - r) * COLS;
          if (r >= this.scroll + ROWS) this.at -= (r - this.scroll - ROWS + 1) * COLS;
          this.at = Math.min(this.at, list.length - 1);
          cx.notify();
        })
        .children(gridRows.map((r) => h_flex().id(`th-row-${r}`).gap(GAP).children(
          Array.from({ length: COLS }, (_, k) => r * COLS + k).map((i) => (i < list.length ? tile(list[i], i) : filler(i)))))));
  }
}
