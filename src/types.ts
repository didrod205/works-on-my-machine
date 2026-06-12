// Data model. A Report is a flat, stable map of facts about one machine —
// designed to be pasted publicly (privacy is enforced at capture time, not
// display time). Everything in this file is pure and browser-safe.

/** Where a fact belongs; drives grouping, diff ordering, and severity. */
export type Section = "os" | "runtime" | "packageManager" | "project" | "env" | "tools";

export interface Fact {
  /** Stable dotted key, e.g. "runtime.node", "project.lockfile.hash". */
  key: string;
  section: Section;
  /** Human label, e.g. "Node". */
  label: string;
  /** Normalized string value ("not installed" facts simply don't appear). */
  value: string;
}

export interface Report {
  /** Schema version for forward compatibility. */
  womm: 1;
  /** Short fingerprint of all facts, e.g. "womm:3fa9c2d1". */
  fingerprint: string;
  /** ISO date (day precision — keeps reports stable within a day). */
  captured: string;
  facts: Fact[];
}

export type DiffSeverity = "critical" | "warning" | "info";

export interface DiffEntry {
  key: string;
  label: string;
  section: Section;
  a?: string;
  b?: string;
  severity: DiffSeverity;
  /** One-line "why this matters", when a rule knows. */
  note?: string;
}

export interface DiffResult {
  same: boolean;
  fingerprintA: string;
  fingerprintB: string;
  entries: DiffEntry[];
  /** Facts present on both sides and equal. */
  matching: number;
}

/** A verdict from the rule engine about THIS machine vs the project's declarations. */
export interface Verdict {
  id: string;
  level: "fail" | "warn";
  message: string;
  fix?: string;
}

export interface Config {
  /** Extra CLI tools to probe, e.g. ["terraform", "ffmpeg"]. */
  extraTools: string[];
  /** Env var NAMES (exact) whose values are safe to include beyond the built-in allowlist. */
  envAllowlist: string[];
  /** Include a salted hash of the hostname (off by default). */
  includeHost: boolean;
}

export interface ProjectDeclarations {
  /** package.json engines.node range, if any. */
  enginesNode?: string;
  enginesNpm?: string;
  /** package.json packageManager field, e.g. "pnpm@9.1.0". */
  packageManager?: string;
  /** .nvmrc / .node-version content, e.g. "20.12.2" or "lts/iron". */
  nvmrc?: string;
  /** .tool-versions nodejs line. */
  toolVersionsNode?: string;
  /** Lockfiles present in the project root. */
  lockfiles: string[];
  /** package.json name@version for display. */
  name?: string;
}

/** What the probes actually found on this machine (input to the pure verdict engine). */
export interface ActualEnv {
  nodeVersion?: string;
  npmVersion?: string;
  pnpmVersion?: string;
  yarnVersion?: string;
  bunVersion?: string;
  nodePath?: string;
  npmRegistry?: string;
  nodeEnv?: string;
  platform?: string;
}
