// The pure heart: build/fingerprint reports, diff them, and explain the damage.
// No node:* imports — a browser playground can diff two pasted reports.

import type { Fact, Report, DiffEntry, DiffResult, DiffSeverity, Section } from "./types.js";
import { sha256 } from "./sha256.js";

const SECTION_ORDER: Section[] = ["runtime", "packageManager", "project", "env", "tools", "os"];

/** Stable sort: section order, then key. */
export function sortFacts(facts: Fact[]): Fact[] {
  return [...facts].sort((a, b) => {
    const sa = SECTION_ORDER.indexOf(a.section);
    const sb = SECTION_ORDER.indexOf(b.section);
    if (sa !== sb) return sa - sb;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

/** Fingerprint = first 8 hex chars of the SHA-256 over the sorted key=value list. */
export function fingerprintFacts(facts: Fact[]): string {
  const canon = sortFacts(facts)
    .map((f) => `${f.key}=${f.value}`)
    .join("\n");
  return `womm:${sha256(canon).slice(0, 8)}`;
}

export function buildReport(facts: Fact[], capturedDate: string): Report {
  const sorted = sortFacts(facts);
  return { womm: 1, fingerprint: fingerprintFacts(sorted), captured: capturedDate, facts: sorted };
}

/** Parse + validate a pasted/loaded report. Throws a friendly error. */
export function parseReport(raw: string): Report {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error("That's not JSON. Expected a report from `womm report` / `womm --json`.");
  }
  const o = v as Partial<Report>;
  if (!o || o.womm !== 1 || !Array.isArray(o.facts)) {
    throw new Error("Not a womm report (missing `womm: 1` / `facts`).");
  }
  const facts: Fact[] = [];
  for (const f of o.facts) {
    if (f && typeof f.key === "string" && typeof f.value === "string") {
      facts.push({
        key: f.key,
        value: f.value,
        label: typeof f.label === "string" ? f.label : f.key,
        section: (f.section as Section) ?? "tools",
      });
    }
  }
  return buildReport(facts, typeof o.captured === "string" ? o.captured : "unknown");
}

// ── Diff ─────────────────────────────────────────────────────────────────────

/** Which keys, when different, usually ARE the bug. */
const SEVERITY_RULES: Array<[RegExp, DiffSeverity, string?]> = [
  [/^runtime\.node$/, "critical", "Different Node majors/minors run different V8, different APIs, different bugs."],
  [/^packageManager\.(npm|pnpm|yarn|bun)$/, "critical", "Different package-manager versions resolve dependency trees differently."],
  [/^packageManager\.active$/, "critical", "Installing the same repo with different package managers yields different node_modules."],
  [/^project\.lockfile\.hash$/, "critical", "Lockfiles differ — you are literally not running the same dependencies."],
  [/^project\.lockfile\.type$/, "critical", "Different lockfile = different package manager = different tree."],
  [/^packageManager\.registry$/, "critical", "A non-default registry can serve different (or stale, or proxied) packages."],
  [/^runtime\.node\.path$/, "warning", "Node from a different source (nvm vs brew vs system) often means a different version tomorrow."],
  [/^env\.NODE_ENV$/, "critical", "NODE_ENV changes dependency installs (dev deps) and framework behavior."],
  [/^env\.NODE_OPTIONS$/, "warning", "NODE_OPTIONS silently changes how Node runs everywhere."],
  [/^os\.platform$/, "warning", "Different OS: case-sensitive paths, line endings, native binaries."],
  [/^os\.arch$/, "warning", "Different CPU arch swaps native binaries (x64 vs arm64 prebuilds)."],
  [/^runtime\./, "warning", undefined],
  [/^project\./, "warning", undefined],
  [/^env\./, "info", undefined],
  [/^tools\./, "info", undefined],
  [/^os\./, "info", undefined],
];

function severityFor(key: string): { severity: DiffSeverity; note?: string } {
  for (const [re, severity, note] of SEVERITY_RULES) {
    if (re.test(key)) return { severity, note };
  }
  return { severity: "info" };
}

const SEV_ORDER: Record<DiffSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Compare two reports. Only differences (and one-sided facts) are returned. */
export function diffReports(a: Report, b: Report): DiffResult {
  const mapA = new Map(a.facts.map((f) => [f.key, f]));
  const mapB = new Map(b.facts.map((f) => [f.key, f]));
  const keys = [...new Set([...mapA.keys(), ...mapB.keys()])];

  const entries: DiffEntry[] = [];
  let matching = 0;
  for (const key of keys) {
    const fa = mapA.get(key);
    const fb = mapB.get(key);
    if (fa && fb && fa.value === fb.value) {
      matching++;
      continue;
    }
    const ref = fa ?? fb!;
    const { severity, note } = severityFor(key);
    entries.push({ key, label: ref.label, section: ref.section, a: fa?.value, b: fb?.value, severity, note });
  }

  entries.sort((x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity] || (x.key < y.key ? -1 : 1));
  return {
    same: entries.length === 0,
    fingerprintA: a.fingerprint,
    fingerprintB: b.fingerprint,
    entries,
    matching,
  };
}
