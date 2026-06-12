// The "why it broke" engine: this machine's actual environment vs what the
// project DECLARES it needs. Pure — probes feed it, tests drive it directly.

import type { ActualEnv, ProjectDeclarations, Verdict } from "./types.js";
import { satisfies, parseVersion, compare } from "./semver.js";

/** "pnpm@9.1.0" → { name: "pnpm", version: "9.1.0" } */
export function parsePackageManagerField(v: string): { name: string; version: string } | null {
  const m = v.trim().match(/^(npm|pnpm|yarn|bun)@(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
  return m ? { name: m[1]!, version: m[2]! } : null;
}

const LOCKFILE_PM: Record<string, string> = {
  "package-lock.json": "npm",
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
  "bun.lock": "bun",
};

export function runVerdicts(actual: ActualEnv, project: ProjectDeclarations): Verdict[] {
  const out: Verdict[] = [];

  // 1. engines.node
  if (project.enginesNode && actual.nodeVersion) {
    const ok = satisfies(actual.nodeVersion, project.enginesNode);
    if (ok === false) {
      out.push({
        id: "engines-node",
        level: "fail",
        message: `This project declares engines.node "${project.enginesNode}" but you're running ${actual.nodeVersion}.`,
        fix: `Switch Node (e.g. \`nvm install ${project.enginesNode.replace(/[^\d.]/g, "") || "the required version"}\`).`,
      });
    }
  }

  // 2. engines.npm
  if (project.enginesNpm && actual.npmVersion) {
    if (satisfies(actual.npmVersion, project.enginesNpm) === false) {
      out.push({
        id: "engines-npm",
        level: "fail",
        message: `engines.npm wants "${project.enginesNpm}" but npm is ${actual.npmVersion}.`,
        fix: "npm install -g npm@<required>",
      });
    }
  }

  // 3. .nvmrc / .node-version / .tool-versions vs active node
  const pinned = project.nvmrc ?? project.toolVersionsNode;
  if (pinned && actual.nodeVersion && /^\d/.test(pinned.trim().replace(/^v/, ""))) {
    const want = parseVersion(pinned);
    const have = parseVersion(actual.nodeVersion);
    if (want && have) {
      const pinnedExact = pinned.trim().split(".").length >= 3;
      const mismatch = pinnedExact
        ? compare(want, have) !== 0
        : want.major !== have.major || (pinned.includes(".") && want.minor !== have.minor);
      if (mismatch) {
        out.push({
          id: "node-pin",
          level: "fail",
          message: `The repo pins Node ${pinned.trim()} (.nvmrc/.tool-versions) but you're on ${actual.nodeVersion}.`,
          fix: "Run `nvm use` (or `asdf install`) in the repo root.",
        });
      }
    }
  }

  // 4. packageManager field vs what's actually used/installed
  if (project.packageManager) {
    const pm = parsePackageManagerField(project.packageManager);
    if (pm) {
      const actualVersion =
        pm.name === "npm" ? actual.npmVersion : pm.name === "pnpm" ? actual.pnpmVersion : pm.name === "yarn" ? actual.yarnVersion : actual.bunVersion;
      if (actualVersion && actualVersion !== pm.version) {
        out.push({
          id: "package-manager-version",
          level: "warn",
          message: `package.json pins ${pm.name}@${pm.version}; you have ${pm.name}@${actualVersion}.`,
          fix: "Enable Corepack (`corepack enable`) so the pinned version is used automatically.",
        });
      }
      if (!actualVersion) {
        out.push({
          id: "package-manager-missing",
          level: "fail",
          message: `package.json says this repo uses ${pm.name}@${pm.version}, but ${pm.name} isn't installed.`,
          fix: "corepack enable && corepack prepare " + `${pm.name}@${pm.version} --activate`,
        });
      }
    }
  }

  // 5. lockfile vs declared/likely package manager
  if (project.lockfiles.length > 1) {
    out.push({
      id: "multiple-lockfiles",
      level: "warn",
      message: `Multiple lockfiles present (${project.lockfiles.join(", ")}) — two installs can disagree about every version.`,
      fix: "Delete all but the one your team actually uses.",
    });
  }
  if (project.packageManager && project.lockfiles.length === 1) {
    const pm = parsePackageManagerField(project.packageManager);
    const lockPm = LOCKFILE_PM[project.lockfiles[0]!];
    if (pm && lockPm && pm.name !== lockPm) {
      out.push({
        id: "lockfile-pm-mismatch",
        level: "fail",
        message: `package.json declares ${pm.name} but the lockfile is ${project.lockfiles[0]} (${lockPm}).`,
        fix: `Reinstall with ${pm.name} (or fix the packageManager field).`,
      });
    }
  }

  // 6. registry
  if (actual.npmRegistry && !/registry\.npmjs\.org\/?$/.test(actual.npmRegistry)) {
    out.push({
      id: "registry",
      level: "warn",
      message: `npm registry is ${actual.npmRegistry} — a mirror/proxy can serve different or stale packages than npmjs.org.`,
    });
  }

  // 7. NODE_ENV=production on a dev machine
  if (actual.nodeEnv === "production") {
    out.push({
      id: "node-env-production",
      level: "warn",
      message: "NODE_ENV=production is set — `npm install` will SKIP devDependencies and frameworks change behavior.",
      fix: "unset NODE_ENV (or set it per-command, not globally).",
    });
  }

  return out;
}
