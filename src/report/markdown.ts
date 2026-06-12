import type { Report, DiffResult, Verdict, Section } from "../types.js";

const SECTION_TITLES: Record<Section, string> = {
  runtime: "Runtime",
  packageManager: "Package manager",
  project: "Project",
  env: "Environment",
  tools: "Tools",
  os: "System",
};

/** The paste-into-your-bug-report block. */
export function reportToMarkdown(r: Report): string {
  const L: string[] = [];
  L.push("<details><summary>🖥️ <b>works on my machine</b> · <code>" + r.fingerprint + "</code> · " + r.captured + "</summary>");
  L.push("");
  let last: Section | null = null;
  for (const f of r.facts) {
    if (f.section !== last) {
      if (last !== null) L.push("");
      L.push(`**${SECTION_TITLES[f.section]}**`);
      L.push("");
      L.push("| | |");
      L.push("| --- | --- |");
      last = f.section;
    }
    L.push(`| ${f.label} | \`${f.value.replace(/\|/g, "\\|")}\` |`);
  }
  L.push("");
  L.push("<sub>generated locally by [womm](https://github.com/didrod205/works-on-my-machine) — paste-safe: paths are masked, env values hidden.</sub>");
  L.push("</details>");
  return L.join("\n") + "\n";
}

export function diffToMarkdown(d: DiffResult, labelA = "A", labelB = "B"): string {
  const L: string[] = [];
  L.push(`# womm diff — ${labelA} vs ${labelB}`);
  L.push("");
  if (d.same) {
    L.push(`✅ **Environments match** (${d.matching} facts identical, \`${d.fingerprintA}\`).`);
    L.push("");
    L.push("If it still doesn't work over there… it's the code. Sorry.");
    return L.join("\n") + "\n";
  }
  L.push(`\`${d.fingerprintA}\` vs \`${d.fingerprintB}\` — **${d.entries.length} difference${d.entries.length === 1 ? "" : "s"}**, ${d.matching} facts matching.`);
  L.push("");
  L.push(`| | What | ${labelA} | ${labelB} |`);
  L.push("| --- | --- | --- | --- |");
  const icon = { critical: "🔴", warning: "🟡", info: "⚪" } as const;
  for (const e of d.entries) {
    L.push(`| ${icon[e.severity]} | ${e.label} | \`${e.a ?? "—"}\` | \`${e.b ?? "—"}\` |`);
  }
  L.push("");
  const notes = d.entries.filter((e) => e.note && e.severity !== "info");
  if (notes.length > 0) {
    L.push("**Why these matter**");
    L.push("");
    for (const e of notes) L.push(`- **${e.label}** — ${e.note}`);
    L.push("");
  }
  return L.join("\n") + "\n";
}

export function verdictsToMarkdown(verdicts: Verdict[]): string {
  if (verdicts.length === 0) return "✅ This machine satisfies everything the project declares.\n";
  const L: string[] = ["# womm check", ""];
  for (const v of verdicts) {
    L.push(`- ${v.level === "fail" ? "❌" : "⚠️"} ${v.message}${v.fix ? `\n  - fix: ${v.fix}` : ""}`);
  }
  return L.join("\n") + "\n";
}
