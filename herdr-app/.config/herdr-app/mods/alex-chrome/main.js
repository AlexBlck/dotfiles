import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, settings } from "herdr";
import { readLimits, usedNow } from "./limits.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

// Footer: only the usage-limit rows (Settings / Add machine are in the palette).
// Per account: two lines, 5-hour window on top, weekly below:
//   Claude  20% ▬▬▭▭▭▭▭  14:30
//           38% ▬▬▬▬▭▭▭  Mon
const LINE_H = 18, ACCOUNT_GAP = 4, PAD_Y = 6, LABEL_W = 64, PCT_W = 30, RESET_W = 38;

const pad2 = (n) => String(n).padStart(2, "0");
// Same day: "14:30". Later: the weekday ("Mon"). Unknown or passed: "".
function resetLabel(w) {
  if (!w?.resets) return "";
  const d = new Date(w.resets * 1000), now = new Date();
  if (d <= now) return "";
  if (d.toDateString() === now.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

// Two Claude accounts both just say "Claude": an auto-named personal org
// ("<email>'s Organization") becomes "Personal", a real org's initials
// ("LEGO Digital Play" -> "LDP") otherwise.
function shortAccount(org) {
  if (!org) return null;
  if (org.includes("@")) return "Personal";
  const words = org.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.map((w) => w[0]).join("").toUpperCase() : org;
}

export default class WorkspaceChrome extends View {
  init(_initProps, cx) {
    this.limits = [];
    if (!props()?.footer) return;
    const poll = (cx) => cx.spawn(async (cx) => {
      try { this.limits = await readLimits(); } catch {}
      cx.notify();
    });
    poll(cx);
    cx.timer.every(60000, poll);
  }

  // One line: label column, "20%", a bar filled to the used share, reset time.
  // Green under 60, yellow under 85, red above.
  meter(t, labelEl, w, barW, id) {
    const used = usedNow(w);
    const pct = used == null ? null : Math.max(0, Math.min(100, used));
    const color = pct == null ? t.dim : pct < 60 ? t.ansi2 : pct < 85 ? t.ansi3 : t.ansi1;
    const mono = settings().font_family ?? "FiraCode Nerd Font Mono";
    return h_flex().id(id).h(LINE_H).px(8).gap(6).items_center()
      .child(labelEl)
      .child(div().w(PCT_W).flex_none().flex().justify_end().font_family(mono).text_size(11).text_color(color)
        .child(pct == null ? "–" : `${Math.round(pct)}%`))
      .child(div().w(barW).flex_none().h(6).rounded(3).bg(t.raised)
        .child(div().h_full().rounded(3).bg(color).w(barW * (pct ?? 0) / 100)))
      .child(div().w(RESET_W).flex_none().font_family(mono).text_size(10.5).text_color(t.dim).child(resetLabel(w)));
  }

  // Plain text label, used for a tool name (or a single account: no ambiguity to resolve).
  label(t, text) {
    return div().w(LABEL_W).flex_none().truncate().text_size(12).text_color(t.muted).child(text ?? "");
  }

  // Two+ accounts for the same tool: a small tool icon plus a short account
  // tag ("Personal", "LDP") instead of a name that only ever reads "Claude…".
  accountLabel(t, l) {
    const short = l.tool === "Claude" ? shortAccount(l.sub) : null;
    if (!short) return this.label(t, l.sub ? `${l.tool} · ${l.sub}` : l.tool);
    return h_flex().w(LABEL_W).flex_none().gap(4).items_center()
      .child(image("icons/claude.svg").size(12).flex_none())
      .child(div().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(short));
  }

  // Keep the footer block exactly as tall as its rows (a sliver when there are none),
  // plus a hairline between accounts when there's more than one.
  fit(accounts) {
    const seps = Math.max(0, accounts - 1);
    const want = accounts ? accounts * 2 * LINE_H + seps * (ACCOUNT_GAP + 2) + 2 * PAD_Y + 1 : 1;
    if (want !== this.height) { this.height = want; run("layout.resize", { id: "sidebar-footer", px: want }); }
  }

  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) {
      const limits = collapsed ? [] : this.limits;
      this.fit(limits.length);
      // The bar takes what's left after padding, label, percentage, reset time and gaps.
      const width = find(layout(), "sidebar")?.size?.px ?? 268;
      const barW = Math.max(16, width - 16 - 16 - LABEL_W - PCT_W - RESET_W - 3 * 6 - 4);
      return v_flex().id("footer-root").size_full().justify_center().gap(ACCOUNT_GAP).bg(t.chrome).border_t(1).border_color(t.border).py(PAD_Y).px(8)
        .children(limits.map((l, i) => v_flex()
          .when(i > 0, el => el.border_t(1).border_color(t.border).pt(2))
          .child(this.meter(t, this.accountLabel(t, l), l.five, barW, `limit-${l.key}-5h`))
          .child(this.meter(t, this.label(t, null), l.week, barW, `limit-${l.key}-7d`))));
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(div().font_semibold().text_color(t.foreground).child("Herdr"))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/alex-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/alex-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
