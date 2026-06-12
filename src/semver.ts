// A tiny, dependency-free semver range checker — just enough for the ranges that
// actually appear in `engines` fields: exact, ^, ~, >=, >, <=, <, =, x/*
// wildcards, hyphen ranges, space-AND, and ||-OR. Prerelease tags compare after
// release versions of the same triple (1.0.0-rc.1 < 1.0.0), which is all the
// nuance an engines check needs.

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  pre: string | null;
}

export function parseVersion(v: string): SemVer | null {
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: m[2] === undefined ? 0 : Number(m[2]),
    patch: m[3] === undefined ? 0 : Number(m[3]),
    pre: m[4] ?? null,
  };
}

export function compare(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1; // release > prerelease
  if (b.pre === null) return -1;
  return a.pre < b.pre ? -1 : a.pre > b.pre ? 1 : 0;
}

interface Bound {
  op: ">=" | ">" | "<=" | "<" | "=";
  v: SemVer;
}

function boundsFor(part: string): Bound[] | null {
  const p = part.trim();
  if (p === "" || p === "*" || p.toLowerCase() === "x") return [];

  const opMatch = p.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (opMatch) {
    const v = parseVersion(opMatch[2]!);
    if (!v) return null;
    return [{ op: opMatch[1] as Bound["op"], v }];
  }

  if (p.startsWith("^")) {
    const v = parseVersion(p.slice(1));
    if (!v) return null;
    const upper: SemVer =
      v.major > 0
        ? { major: v.major + 1, minor: 0, patch: 0, pre: null }
        : v.minor > 0
          ? { major: 0, minor: v.minor + 1, patch: 0, pre: null }
          : { major: 0, minor: 0, patch: v.patch + 1, pre: null };
    return [
      { op: ">=", v },
      { op: "<", v: upper },
    ];
  }

  if (p.startsWith("~")) {
    const v = parseVersion(p.slice(1));
    if (!v) return null;
    return [
      { op: ">=", v },
      { op: "<", v: { major: v.major, minor: v.minor + 1, patch: 0, pre: null } },
    ];
  }

  // 18 / 18.x / 18.17 / 18.17.x wildcards
  const wild = p.match(/^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i);
  if (wild) {
    const major = Number(wild[1]);
    const minorRaw = wild[2];
    const patchRaw = wild[3];
    const minorWild = minorRaw === undefined || /^[x*]$/i.test(minorRaw);
    const patchWild = patchRaw === undefined || /^[x*]$/i.test(patchRaw);
    if (minorWild) {
      return [
        { op: ">=", v: { major, minor: 0, patch: 0, pre: null } },
        { op: "<", v: { major: major + 1, minor: 0, patch: 0, pre: null } },
      ];
    }
    const minor = Number(minorRaw);
    if (patchWild) {
      return [
        { op: ">=", v: { major, minor, patch: 0, pre: null } },
        { op: "<", v: { major, minor: minor + 1, patch: 0, pre: null } },
      ];
    }
    const v = parseVersion(p);
    if (!v) return null;
    return [{ op: "=", v }];
  }

  const exact = parseVersion(p);
  if (exact) return [{ op: "=", v: exact }];
  return null;
}

function checkBound(version: SemVer, b: Bound): boolean {
  const c = compare(version, b.v);
  switch (b.op) {
    case ">=":
      return c >= 0;
    case ">":
      return c > 0;
    case "<=":
      return c <= 0;
    case "<":
      return c < 0;
    case "=":
      return c === 0;
  }
}

/**
 * Does `version` satisfy `range`? Returns null when the range uses syntax we
 * don't understand (callers should treat null as "can't tell", never "no").
 */
export function satisfies(version: string, range: string): boolean | null {
  const v = parseVersion(version);
  if (!v) return null;

  const orParts = range.split("||");
  let understood = false;
  for (const orPart of orParts) {
    // hyphen range "1.2.3 - 2.0.0"
    const hyphen = orPart.match(/^\s*([\w.*-]+)\s+-\s+([\w.*-]+)\s*$/);
    let bounds: Bound[] | null;
    if (hyphen) {
      const lo = parseVersion(hyphen[1]!);
      const hiRaw = hyphen[2]!;
      const hi = parseVersion(hiRaw);
      if (lo && hi) {
        // npm semantics: a PARTIAL upper bound means "less than the next one":
        // "14 - 16" → <17.0.0, "14 - 16.2" → <16.3.0, "14 - 16.2.1" → <=16.2.1.
        const dots = hiRaw.replace(/^v/i, "").split(".").length - 1;
        const upper: Bound =
          dots >= 2
            ? { op: "<=", v: hi }
            : dots === 1
              ? { op: "<", v: { major: hi.major, minor: hi.minor + 1, patch: 0, pre: null } }
              : { op: "<", v: { major: hi.major + 1, minor: 0, patch: 0, pre: null } };
        bounds = [{ op: ">=", v: lo }, upper];
      } else {
        bounds = null;
      }
    } else {
      const ands = orPart.trim().split(/\s+/).filter(Boolean);
      bounds = [];
      for (const part of ands) {
        const b = boundsFor(part);
        if (b === null) {
          bounds = null;
          break;
        }
        bounds.push(...b);
      }
    }
    if (bounds === null) continue;
    understood = true;
    if (bounds.every((b) => checkBound(v, b))) return true;
  }
  return understood ? false : null;
}
