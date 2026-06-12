// Privacy at capture time. Reports are designed to be pasted into public issues,
// so anything personally identifying is stripped/normalized BEFORE it ever
// enters a Fact — there is no "raw" report to leak.

import { sha256 } from "./sha256.js";

/** Env var names whose VALUES are safe and useful. Everything else: name only, never the value. */
export const ENV_VALUE_ALLOWLIST = new Set([
  "NODE_ENV",
  "CI",
  "TERM",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TZ",
  "NODE_OPTIONS",
  "COREPACK_ENABLE_STRICT",
  "npm_config_registry",
]);

/** Env var names worth REPORTING AS PRESENT (value masked unless allowlisted). */
export const ENV_INTERESTING = [
  "NODE_ENV",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_EXTRA_CA_CERTS",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "CI",
  "TZ",
  "LANG",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "ELECTRON_RUN_AS_NODE",
];

/** Replace the user's home directory (and username inside paths) with "~". */
export function maskPath(p: string, home: string, username?: string): string {
  let out = p;
  if (home && out.startsWith(home)) out = "~" + out.slice(home.length);
  if (home) out = out.split(home).join("~");
  if (username && username.length > 1) {
    out = out.split(`/Users/${username}`).join("/Users/~");
    out = out.split(`/home/${username}`).join("/home/~");
    out = out.split(`\\Users\\${username}`).join("\\Users\\~");
  }
  return out;
}

/** Mask an env value entirely (we show presence, not content). */
export function maskValue(v: string): string {
  if (v.length === 0) return "(empty)";
  return `(set, ${v.length} chars)`;
}

/** A salted short hash for the hostname — same machine → same tag, name unrecoverable. */
export function hostTag(hostname: string): string {
  return "host-" + sha256("womm-host:" + hostname).slice(0, 6);
}

/** Suspicious substrings that must never appear in a fact value. */
const LEAK_RE = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.)/;

/** Last-line-of-defense scrub applied to every fact value. */
export function scrubValue(v: string): string {
  return v.replace(new RegExp(LEAK_RE, "g"), "‹redacted›");
}
