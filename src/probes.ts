// Node-only: gather facts about THIS machine. Every external call is
// best-effort (missing tool = no fact), time-boxed, and privacy-masked before
// becoming a Fact. No network. No telemetry. Obviously.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { platform, release, arch, cpus, totalmem, homedir, hostname, userInfo } from "node:os";
import { sep } from "node:path";
import type { Fact, Config, ActualEnv, ProjectDeclarations, Section } from "./types.js";
import { maskPath, maskValue, hostTag, scrubValue, ENV_INTERESTING, ENV_VALUE_ALLOWLIST } from "./mask.js";
import { sha256 } from "./sha256.js";

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, NO_COLOR: "1" },
    }).trim();
  } catch {
    return null;
  }
}

/** First line, with common "v" prefixes and tool-name noise stripped. */
function versionOf(cmd: string, args: string[] = ["--version"]): string | null {
  const out = run(cmd, args);
  if (!out) return null;
  const first = out.split("\n")[0]!.trim();
  const m = first.match(/\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/);
  return m ? m[0] : first.slice(0, 40);
}

/** Resolve a command's path via `which`/`where` and mask it. */
function pathOf(cmd: string, home: string, user: string): string | null {
  const out = run(process.platform === "win32" ? "where" : "which", [cmd]);
  if (!out) return null;
  const p = out.split("\n")[0]!.trim();
  // Classify the source — the classification is often more useful than the path.
  const masked = maskPath(p, home, user);
  let source = "system";
  if (p.includes(`${sep}.nvm${sep}`)) source = "nvm";
  else if (p.includes(`${sep}.fnm${sep}`) || p.includes("fnm_multishells")) source = "fnm";
  else if (p.includes(`${sep}.volta${sep}`)) source = "volta";
  else if (p.includes(`${sep}.asdf${sep}`)) source = "asdf";
  else if (p.includes("/opt/homebrew/") || p.includes("/usr/local/Cellar/")) source = "homebrew";
  else if (p.includes("Program Files")) source = "installer";
  return `${source} (${masked})`;
}

export interface CaptureResult {
  facts: Fact[];
  actual: ActualEnv;
  project: ProjectDeclarations;
}

const TOOLS: Array<[label: string, cmd: string, args?: string[]]> = [
  ["git", "git"],
  ["docker", "docker"],
  ["python3", "python3"],
  ["go", "go", ["version"]],
  ["rustc", "rustc"],
  ["java", "java", ["-version"]],
];

export function readProject(cwd: string): ProjectDeclarations {
  const decl: ProjectDeclarations = { lockfiles: [] };
  try {
    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      const engines = (pkg["engines"] ?? {}) as Record<string, unknown>;
      if (typeof engines["node"] === "string") decl.enginesNode = engines["node"];
      if (typeof engines["npm"] === "string") decl.enginesNpm = engines["npm"];
      if (typeof pkg["packageManager"] === "string") decl.packageManager = pkg["packageManager"];
      if (typeof pkg["name"] === "string") {
        decl.name = pkg["name"] + (typeof pkg["version"] === "string" ? `@${pkg["version"]}` : "");
      }
    }
  } catch {
    // unreadable package.json → no declarations, the capture still works
  }
  for (const f of [".nvmrc", ".node-version"]) {
    try {
      const p = join(cwd, f);
      if (existsSync(p)) {
        decl.nvmrc = readFileSync(p, "utf8").trim();
        break;
      }
    } catch {
      // ignore
    }
  }
  try {
    const tv = join(cwd, ".tool-versions");
    if (existsSync(tv)) {
      const line = readFileSync(tv, "utf8").split("\n").find((l) => l.startsWith("nodejs "));
      if (line) decl.toolVersionsNode = line.slice("nodejs ".length).trim();
    }
  } catch {
    // ignore
  }
  for (const lf of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"]) {
    if (existsSync(join(cwd, lf))) decl.lockfiles.push(lf);
  }
  return decl;
}

export function capture(cwd: string, config: Config): CaptureResult {
  const facts: Fact[] = [];
  const home = homedir();
  let user = "";
  try {
    user = userInfo().username;
  } catch {
    // some containers have no user db entry
  }
  const add = (section: Section, key: string, label: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    facts.push({ section, key, label, value: scrubValue(value) });
  };

  // OS
  add("os", "os.platform", "OS", `${platform()} ${release()}`);
  add("os", "os.arch", "Arch", arch());
  const cpu = cpus()[0]?.model?.trim();
  add("os", "os.cpu", "CPU", cpu ? `${cpu} ×${cpus().length}` : undefined);
  add("os", "os.memory", "RAM", `${Math.round(totalmem() / 1024 ** 3)} GB`);
  add("os", "os.shell", "Shell", basename(process.env["SHELL"] ?? "") || undefined);
  if (config.includeHost) add("os", "os.host", "Host", hostTag(hostname()));

  // Runtime: node itself (we ARE node — free and exact)
  const nodeVersion = process.version.replace(/^v/, "");
  add("runtime", "runtime.node", "Node", nodeVersion);
  const nodePath = pathOf("node", home, user);
  add("runtime", "runtime.node.path", "Node from", nodePath);

  // Package managers
  const npmVersion = versionOf("npm");
  const pnpmVersion = versionOf("pnpm");
  const yarnVersion = versionOf("yarn");
  const bunVersion = versionOf("bun");
  add("packageManager", "packageManager.npm", "npm", npmVersion);
  add("packageManager", "packageManager.pnpm", "pnpm", pnpmVersion);
  add("packageManager", "packageManager.yarn", "yarn", yarnVersion);
  add("packageManager", "packageManager.bun", "bun", bunVersion);
  const registry = run("npm", ["config", "get", "registry"]);
  add("packageManager", "packageManager.registry", "npm registry", registry ?? undefined);

  // Project context
  const project = readProject(cwd);
  add("project", "project.name", "Project", project.name);
  add("project", "project.engines.node", "engines.node", project.enginesNode);
  add("project", "project.packageManager", "packageManager", project.packageManager);
  add("project", "project.node.pin", "Node pin (.nvmrc)", project.nvmrc ?? project.toolVersionsNode);
  if (project.lockfiles.length > 0) {
    add("project", "project.lockfile.type", "Lockfile", project.lockfiles.join(", "));
    const active = project.lockfiles[0]!;
    try {
      const lockRaw = readFileSync(join(cwd, active));
      add("project", "project.lockfile.hash", "Lockfile hash", "sha256:" + sha256(lockRaw.toString("utf8")).slice(0, 12));
    } catch {
      // unreadable lockfile — skip the hash
    }
    add("project", "project.node_modules", "node_modules", existsSync(join(cwd, "node_modules")) ? "present" : "absent");
  }

  // Interesting env vars (presence always, value only if allowlisted)
  for (const name of [...ENV_INTERESTING, ...config.envAllowlist]) {
    const v = process.env[name];
    if (v === undefined) continue;
    const safe = ENV_VALUE_ALLOWLIST.has(name) || config.envAllowlist.includes(name);
    add("env", `env.${name}`, name, safe ? v : maskValue(v));
  }

  // Locale/timezone (classic "works here" causes for date/string tests)
  add("env", "env.TZ.resolved", "Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  add("env", "env.locale.resolved", "Locale", Intl.DateTimeFormat().resolvedOptions().locale);

  // Other tools
  for (const [label, cmd, args] of TOOLS) {
    add("tools", `tools.${label}`, label, versionOf(cmd, args));
  }
  for (const extra of config.extraTools) {
    if (!/^[\w.@+-]+$/.test(extra)) continue; // no shell metachars from config
    add("tools", `tools.${extra}`, extra, versionOf(extra));
  }

  const actual: ActualEnv = {
    nodeVersion,
    npmVersion: npmVersion ?? undefined,
    pnpmVersion: pnpmVersion ?? undefined,
    yarnVersion: yarnVersion ?? undefined,
    bunVersion: bunVersion ?? undefined,
    nodePath: nodePath ?? undefined,
    npmRegistry: registry ?? undefined,
    nodeEnv: process.env["NODE_ENV"],
    platform: platform(),
  };

  // Which PM is "active" for this repo (from packageManager field or the lockfile)
  if (project.packageManager) {
    add("packageManager", "packageManager.active", "Declared PM", project.packageManager.split("@")[0]);
  } else if (project.lockfiles[0]) {
    const map: Record<string, string> = {
      "package-lock.json": "npm",
      "pnpm-lock.yaml": "pnpm",
      "yarn.lock": "yarn",
      "bun.lockb": "bun",
      "bun.lock": "bun",
    };
    add("packageManager", "packageManager.active", "Likely PM (lockfile)", map[project.lockfiles[0]] ?? "unknown");
  }

  return { facts, actual, project };
}
