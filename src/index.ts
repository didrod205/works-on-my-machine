// Public, browser-safe API: build/parse/diff reports and run verdict rules on
// data from anywhere. Node-only pieces (probes, load-config, CLI) are NOT here.

export type {
  Section,
  Fact,
  Report,
  DiffSeverity,
  DiffEntry,
  DiffResult,
  Verdict,
  Config,
  ProjectDeclarations,
  ActualEnv,
} from "./types.js";

export { buildReport, parseReport, diffReports, fingerprintFacts, sortFacts } from "./core.js";
export { runVerdicts, parsePackageManagerField } from "./verdicts.js";
export { satisfies, parseVersion, compare } from "./semver.js";
export { sha256 } from "./sha256.js";
export { renderBadge } from "./badge.js";
export type { BadgeOptions } from "./badge.js";
export { maskPath, maskValue, hostTag, scrubValue, ENV_VALUE_ALLOWLIST, ENV_INTERESTING } from "./mask.js";
export { reportToMarkdown, diffToMarkdown, verdictsToMarkdown } from "./report/markdown.js";
export { DEFAULT_CONFIG, CONFIG_FILENAMES, parseConfig, mergeConfig } from "./config.js";
