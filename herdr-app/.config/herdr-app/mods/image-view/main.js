// Shows one image file in a pane. Open it beside a terminal:
//   herdr-app do pane.split '{"direction":"right","mod":"image-view","props":{"file":"N:/path/to/img.png"}}'
// props: { file: absolute path, machine?: name from `hc machine ls` (null = this computer) }.
// Files on another machine are copied into data/image-view-cache/ first.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, theme, run, exec, focused, window, appHome, writeTextFile } from "herdr";

const CACHE = "data/image-view-cache";

function baseName(p) { return String(p ?? "").split(/[\\/]/).pop() || "image"; }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

export default class ImageView extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.file = p.file ?? null;
    this.machine = p.machine ?? null;
    this.src = null;      // what image() gets
    this.error = null;
    this.version = 0;     // bumps on reload
    if (!this.file) { this.error = "No file given (props.file)."; return; }
    cx.spawn(async (cx) => { await this.load(); cx.notify(); });
  }

  async load() {
    this.error = null;
    try {
      if (!this.machine) {
        // Local file: image() resolves relative paths against the app folder,
        // an absolute path is used as-is.
        this.src = this.file.replace(/\\/g, "/");
        return;
      }
      // Remote: pull the bytes over as base64 and decode into the cache.
      const r = await exec("base64", ["-w0", this.file], { on: this.machine });
      if (r.code !== 0) throw new Error(r.stderr.trim() || `base64 exited ${r.code}`);
      const ext = (this.file.match(/\.[A-Za-z0-9]+$/)?.[0] ?? ".png").toLowerCase();
      const rel = `${CACHE}/${hash(`${this.machine}:${this.file}`)}-${this.version}${ext}`;
      const home = appHome().replace(/\\/g, "/");
      const b64 = `${home}/${rel}.${Date.now()}.b64`, out = `${home}/${rel}`;
      const win = window()?.platform === "windows", w = (p) => p.replace(/\//g, "\\");
      if (win) await exec("cmd", ["/c", `if not exist "${w(`${home}/${CACHE}`)}" mkdir "${w(`${home}/${CACHE}`)}"`]);
      else await exec("mkdir", ["-p", `${home}/${CACHE}`]);
      await writeTextFile(b64, r.stdout, null);
      const d = win
        ? await exec("certutil", ["-f", "-decode", w(b64), w(out)])
        : await exec("sh", ["-c", 'base64 -d "$0" > "$1"', b64, out]);
      await (win ? exec("cmd", ["/c", "del", "/q", w(b64)]) : exec("rm", ["-f", b64]));
      if (d.code !== 0) throw new Error(`decode failed: ${(d.stderr || d.stdout).trim()}`);
      this.src = rel;
    } catch (e) {
      this.error = String(e?.message ?? e);
    }
  }

  render(cx) {
    const t = theme();
    const btn = (id, icon, title, action) => div().id(id).size(22).flex_none().flex().items_center().justify_center().rounded(5)
      .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); action(cx); })
      .child(icon);
    const where = this.machine ? `${this.machine}: ` : "";
    const bar = h_flex().h(28).flex_none().px(8).gap(6).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(12.5)
      .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(baseName(this.file)))
      .child(div().max_w(320).truncate().text_color(t.dim).child(where + (this.file ?? "")))
      .child(btn("iv-reload", "⟳", "Reload", (cx) => { this.version++; this.src = null; cx.notify(); cx.spawn(async (cx) => { await this.load(); cx.notify(); }); }))
      .when(!this.machine && Boolean(this.file), el => el.child(btn("iv-open", "↗", "Open in default app", () => {
        const f = this.file.replace(/\//g, "\\");
        if (window()?.platform === "windows") exec("explorer", [f]);
        else exec(window()?.platform === "macos" ? "open" : "xdg-open", [this.file]);
      })))
      .child(btn("iv-close", svg("mods/pane/close.svg").size(12), "Close", () => {
        const f = focused();
        if (f?.pane && !f.terminal) run("pane.close", { pane: f.pane });
      }));
    const body = this.error
      ? div().p(16).text_color(t.error ?? t.blocked).child(this.error)
      : this.src
        ? div().id(`iv-img-${this.version}`).flex_1().min_h(0).p(8).flex().items_center().justify_center()
            .child(image(this.src).max_w_full().max_h_full())
        : div().p(16).text_color(t.dim).child("Loading…");
    return v_flex().size_full().bg(t.background).child(bar).child(body);
  }
}
