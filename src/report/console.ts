import pc from "picocolors";
import type { Report, DiffResult, Verdict, Section } from "../types.js";

const SECTION_TITLES: Record<Section, string> = {
  runtime: "Runtime",
  packageManager: "Package manager",
  project: "Project",
  env: "Environment",
  tools: "Tools",
  os: "System",
};

export function renderReport(r: Report): string {
  const L: string[] = [];
  const ind = "  ";
  L.push("");
  L.push(`${ind}${pc.green("✓")} ${pc.bold("works on my machine")}  ${pc.dim("·")}  ${pc.cyan(r.fingerprint)}  ${pc.dim(r.captured)}`);
  L.push(`${ind}${pc.dim("🔒 captured locally · paths masked · env values hidden · nothing uploaded")}`);
  let last: Section | null = null;
  const labelW = Math.max(...r.facts.map((f) => f.label.length)) + 2;
  for (const f of r.facts) {
    if (f.section !== last) {
      L.push("");
      L.push(`${ind}${pc.bold(SECTION_TITLES[f.section])}`);
      last = f.section;
    }
    L.push(`${ind}${pc.dim(f.label.padEnd(labelW))}${f.value}`);
  }
  L.push("");
  L.push(`${ind}${pc.dim("→ paste into an issue:")} ${pc.cyan("npx womm --md")}   ${pc.dim("→ compare:")} ${pc.cyan("npx womm diff their-report.json")}`);
  L.push("");
  return L.join("\n");
}

export function renderDiff(d: DiffResult, labelA: string, labelB: string): string {
  const L: string[] = [];
  const ind = "  ";
  L.push("");
  if (d.same) {
    L.push(`${ind}${pc.green("✓ Environments match.")} ${pc.dim(`${d.matching} facts identical · ${d.fingerprintA}`)}`);
    L.push(`${ind}${pc.dim("If it still doesn't work over there… it's the code. Sorry.")}`);
    L.push("");
    return L.join("\n");
  }
  L.push(
    `${ind}${pc.bold(`${d.entries.length} difference${d.entries.length === 1 ? "" : "s"}`)} ${pc.dim(
      `· ${d.matching} matching · ${labelA} ${d.fingerprintA} vs ${labelB} ${d.fingerprintB}`,
    )}`,
  );
  L.push("");
  const icon = { critical: pc.red("●"), warning: pc.yellow("●"), info: pc.dim("○") } as const;
  const w = Math.max(...d.entries.map((e) => e.label.length)) + 2;
  for (const e of d.entries) {
    L.push(`${ind}${icon[e.severity]} ${e.label.padEnd(w)}${pc.cyan(e.a ?? "—")} ${pc.dim("vs")} ${pc.magenta(e.b ?? "—")}`);
    if (e.note && e.severity !== "info") L.push(`${ind}  ${pc.dim("└ " + e.note)}`);
  }
  const crits = d.entries.filter((e) => e.severity === "critical").length;
  L.push("");
  if (crits > 0) {
    L.push(`${ind}${pc.red(`▲ ${crits} critical difference${crits === 1 ? "" : "s"} — start there.`)}`);
  } else {
    L.push(`${ind}${pc.yellow("No critical differences — if it still breaks, look at the warnings.")}`);
  }
  L.push("");
  return L.join("\n");
}

export function renderVerdicts(verdicts: Verdict[]): string {
  const L: string[] = [];
  const ind = "  ";
  L.push("");
  if (verdicts.length === 0) {
    L.push(`${ind}${pc.green("✓ This machine satisfies everything the project declares.")}`);
    L.push(`${ind}${pc.dim("engines · .nvmrc/.tool-versions · packageManager · lockfile — all consistent")}`);
    L.push("");
    return L.join("\n");
  }
  for (const v of verdicts) {
    L.push(`${ind}${v.level === "fail" ? pc.red("✗") : pc.yellow("⚠")} ${v.message}`);
    if (v.fix) L.push(`${ind}  ${pc.dim("fix: " + v.fix)}`);
  }
  L.push("");
  return L.join("\n");
}
