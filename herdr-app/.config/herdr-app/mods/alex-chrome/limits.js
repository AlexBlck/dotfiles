// Plan usage limits (5-hour and weekly) per account, for the sidebar footer.
//
// Sources, per machine (this computer + every machine in machines()):
//   Claude: ~/.cache/agent-limits/claude.json, written by the statusLine script
//           ~/.local/bin/agent_limits_statusline.py on each Claude Code update.
//   Codex:  the newest ~/.codex/sessions rollout's `rate_limits` event.
// Rows are per account, not per machine: the same account seen on two
// machines shows once (the freshest reading wins).
import { readTextFile, exec, home, machines } from "herdr";

// \x01 (SOH) marks each section: unlike "@", it can't collide with an
// account email, a URL, or anything else that shows up in the payloads.
const SOH = "";

const REMOTE = [
  "printf '\\001claude\\n'; cat ~/.cache/agent-limits/claude.json 2>/dev/null",
  "printf '\\n\\001codex\\n'; f=$(find ~/.codex/sessions -name '*.jsonl' -mtime -8 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1);" +
    " [ -n \"$f\" ] && grep -o '\"rate_limits\":{.*' \"$f\" | tail -1",
  "printf '\\n\\001codexacct\\n'; grep -o '\"account_id\": *\"[^\"]*\"' ~/.codex/auth.json 2>/dev/null | head -1",
].join("; ");

// The same Codex lookup for this computer when it's Windows.
const LOCAL_CODEX = [
  "$d = Join-Path $env:USERPROFILE '.codex\\sessions'",
  "[char]1 + 'codex'",
  "if (Test-Path $d) { $f = Get-ChildItem $d -Recurse -Filter *.jsonl -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-8) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1;" +
    " if ($f) { $m = Select-String -Path $f.FullName -Pattern '\"rate_limits\":\\{.*' -AllMatches | Select-Object -Last 1; if ($m) { $m.Matches[-1].Value } } }",
  "[char]1 + 'codexacct'",
  "$a = Join-Path $env:USERPROFILE '.codex\\auth.json'; if (Test-Path $a) { (Select-String -Path $a -Pattern '\"account_id\": *\"[^\"]*\"' | Select-Object -First 1).Matches[0].Value }",
].join("; ");

// The JSON object starting at text[start] (brace-matched; the grep keeps the line's tail).
function objectAt(text, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  return null;
}

function section(out, name) {
  const m = out.split(new RegExp(`\\n?${SOH}`)).find((s) => s.startsWith(name + "\n"));
  return m ? m.slice(name.length + 1).trim() : "";
}

function claudeRow(text, machine) {
  if (!text) return null;
  try {
    const d = JSON.parse(text);
    return {
      tool: "Claude", key: `claude:${d.account?.id ?? machine ?? "local"}`, sub: d.account?.org ?? machine ?? null,
      updated: d.updated ?? 0,
      five: d.five_hour ? { used: d.five_hour.used, resets: d.five_hour.resets_at } : null,
      week: d.seven_day ? { used: d.seven_day.used, resets: d.seven_day.resets_at } : null,
    };
  } catch { return null; }
}

function codexRow(text, acct, machine) {
  if (!text) return null;
  try {
    const r = objectAt(text, text.indexOf("{"));
    if (!r) return null;
    const win = (w) => (w ? { used: w.used_percent, resets: w.resets_at } : null);
    const byLen = [r.primary, r.secondary].filter(Boolean);
    const five = byLen.find((w) => w.window_minutes <= 300) ?? r.primary;
    const week = byLen.find((w) => w.window_minutes >= 10080) ?? r.secondary;
    const id = acct.match(/"account_id": *"([^"]*)"/)?.[1];
    return {
      tool: "Codex", key: `codex:${id ?? machine ?? "local"}`, sub: r.plan_type ?? machine ?? null,
      updated: Math.max(five?.resets_at ?? 0, week?.resets_at ?? 0) - 10080 * 60,
      five: win(five), week: win(week),
    };
  } catch { return null; }
}

export async function readLimits(log = () => {}) {
  const rows = [];
  log("local…");
  // This computer: Claude's file, and Codex's newest session log (PowerShell, no sh on Windows).
  try { rows.push(claudeRow(await readTextFile(`${home()}/.cache/agent-limits/claude.json`), null)); } catch {}
  try {
    const r = await exec("powershell", ["-NoProfile", "-NonInteractive", "-Command", LOCAL_CODEX]);
    rows.push(codexRow(section(r.stdout.replace(/\r/g, ""), "codex"), section(r.stdout.replace(/\r/g, ""), "codexacct"), null));
  } catch {}
  for (const m of machines()) {
    if (!m.name || m.temporary || m.layout === "unavailable") continue;
    try {
      log(`exec ${m.name}…`);
      const r = await exec("sh", ["-c", REMOTE], { on: m.name });
      rows.push(claudeRow(section(r.stdout, "claude"), m.name));
      rows.push(codexRow(section(r.stdout, "codex"), section(r.stdout, "codexacct"), m.name));
    } catch (e) { log(`exec ${m.name} ERR ${e}`); }
  }
  log(`rows ${rows.filter(Boolean).length}`);
  const best = new Map();
  for (const r of rows.filter(Boolean)) {
    const prev = best.get(r.key);
    if (!prev || r.updated > prev.updated) best.set(r.key, r);
  }
  const list = [...best.values()].sort((a, b) => a.tool.localeCompare(b.tool));
  // Only name the account when one tool has several.
  for (const r of list) if (list.filter((o) => o.tool === r.tool).length < 2) r.sub = null;
  return list;
}

// A window whose reset time has passed is back at 0.
export function usedNow(w) {
  if (!w || w.used == null) return null;
  return w.resets && w.resets * 1000 < Date.now() ? 0 : w.used;
}
