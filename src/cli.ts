#!/usr/bin/env node
import { cac } from "cac";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config, Report } from "./types.js";
import { buildReport, parseReport, diffReports } from "./core.js";
import { capture, readProject } from "./probes.js";
import { runVerdicts } from "./verdicts.js";
import { loadConfig } from "./load-config.js";
import { renderBadge } from "./badge.js";
import { reportToMarkdown, diffToMarkdown, verdictsToMarkdown } from "./report/markdown.js";

const VERSION = "0.1.0";

interface Flags {
  config?: string;
  includeHost?: boolean;
  tool?: string | string[];
  json?: boolean | string;
  md?: boolean | string;
  quiet?: boolean;
  color?: boolean;
}

function fail(message: string): never {
  process.stderr.write(`\nwomm: ${message}\n\n`);
  process.exit(2);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getConfig(flags: Flags): Config {
  let loaded;
  try {
    loaded = loadConfig(process.cwd(), flags.config);
  } catch (err) {
    fail((err as Error).message);
  }
  const config = { ...loaded.config };
  if (flags.includeHost) config.includeHost = true;
  const extra = flags.tool === undefined ? [] : Array.isArray(flags.tool) ? flags.tool : [flags.tool];
  config.extraTools = [...config.extraTools, ...extra];
  return config;
}

function captureReport(flags: Flags): Report {
  const config = getConfig(flags);
  const { facts } = capture(process.cwd(), config);
  return buildReport(facts, todayISO());
}

function writeOutputs(report: Report, flags: Flags, defaultAll = false): string[] {
  const written: string[] = [];
  const target = (flag: boolean | string | undefined, fallback: string): string | null => {
    if (flag === undefined) return defaultAll ? resolve(fallback) : null;
    return resolve(typeof flag === "string" ? flag : fallback);
  };
  const jsonPath = target(flags.json, "womm.json");
  const mdPath = target(flags.md, "womm.md");
  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    written.push(jsonPath);
  }
  if (mdPath) {
    writeFileSync(mdPath, reportToMarkdown(report), "utf8");
    written.push(mdPath);
  }
  return written;
}

async function cmdCapture(flags: Flags): Promise<void> {
  const report = captureReport(flags);
  if (!flags.quiet) {
    if (flags.color === false) process.env["NO_COLOR"] = "1";
    const { renderReport } = await import("./report/console.js");
    process.stdout.write(renderReport(report));
  }
  // `--md` / `--json` without a value print to stdout when quiet, else write files.
  const written = writeOutputs(report, flags);
  if (written.length > 0 && !flags.quiet) {
    process.stdout.write(`  Wrote: ${written.join(", ")}\n\n`);
  }
  if (flags.quiet && flags.md !== undefined && typeof flags.md === "boolean") {
    process.stdout.write(reportToMarkdown(report));
  }
  if (flags.quiet && flags.json !== undefined && typeof flags.json === "boolean") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }
}

async function cmdDiff(fileA: string, fileB: string | undefined, flags: Flags): Promise<void> {
  const load = (p: string): Report => {
    const abs = resolve(p);
    if (!existsSync(abs)) fail(`File not found: ${p}`);
    try {
      return parseReport(readFileSync(abs, "utf8"));
    } catch (err) {
      fail(`${p}: ${(err as Error).message}`);
    }
  };
  const a = load(fileA);
  const labelA = fileA;
  let b: Report;
  let labelB: string;
  if (fileB) {
    b = load(fileB);
    labelB = fileB;
  } else {
    b = captureReport(flags);
    labelB = "this machine";
  }
  const d = diffReports(a, b);
  if (flags.color === false) process.env["NO_COLOR"] = "1";
  if (flags.md !== undefined) {
    const md = diffToMarkdown(d, labelA, labelB);
    if (typeof flags.md === "string") {
      writeFileSync(resolve(flags.md), md, "utf8");
      process.stdout.write(`Wrote ${resolve(flags.md)}\n`);
    } else {
      process.stdout.write(md);
    }
  } else {
    const { renderDiff } = await import("./report/console.js");
    process.stdout.write(renderDiff(d, labelA, labelB));
  }
  process.exitCode = d.same ? 0 : 1;
}

async function cmdCheck(flags: Flags): Promise<void> {
  const config = getConfig(flags);
  const { actual, project } = capture(process.cwd(), config);
  const verdicts = runVerdicts(actual, project);
  if (flags.color === false) process.env["NO_COLOR"] = "1";
  if (flags.md !== undefined) {
    process.stdout.write(verdictsToMarkdown(verdicts));
  } else {
    const { renderVerdicts } = await import("./report/console.js");
    process.stdout.write(renderVerdicts(verdicts));
  }
  process.exitCode = verdicts.some((v) => v.level === "fail") ? 1 : 0;
}

const cli = cac("womm");

cli
  .command("[file]", "Capture this machine (default). With a file: diff against it.")
  .option("--include-host", "Include a salted hash of the hostname")
  .option("--tool <cmd>", "Probe an extra CLI tool's version (repeatable)")
  .option("--config <file>", "Path to womm.config.json")
  .option("--json [file]", "Write (or with --quiet, print) the JSON report")
  .option("--md [file]", "Write (or with --quiet, print) the Markdown paste-block")
  .option("--quiet", "No pretty output")
  .option("--no-color", "Disable colors")
  .action(async (file: string | undefined, flags: Flags) => {
    if (file) return cmdDiff(file, undefined, flags);
    return cmdCapture(flags);
  });

cli
  .command("report", "Write womm.json + womm.md to share")
  .option("--include-host", "Include a salted hash of the hostname")
  .option("--tool <cmd>", "Probe an extra CLI tool (repeatable)")
  .option("--config <file>", "Path to womm.config.json")
  .option("--json [file]", "JSON path (default womm.json)")
  .option("--md [file]", "Markdown path (default womm.md)")
  .option("--quiet", "No pretty output")
  .action(async (flags: Flags) => {
    const report = captureReport(flags);
    const written = writeOutputs(report, flags, true);
    process.stdout.write(`\n  ${report.fingerprint} captured.\n  Wrote:\n${written.map((w) => `    ${w}`).join("\n")}\n\n  Attach womm.md to your bug report — or have them run \`npx womm womm.json\` to diff.\n\n`);
  });

cli
  .command("diff <fileA> [fileB]", "Diff two reports (one file = vs this machine)")
  .option("--md [file]", "Markdown output (default: pretty terminal)")
  .option("--config <file>", "Path to womm.config.json")
  .option("--no-color", "Disable colors")
  .action(cmdDiff);

cli
  .command("check", "Verify this machine against the project's declarations (CI/onboarding gate)")
  .option("--md", "Markdown output")
  .option("--config <file>", "Path to womm.config.json")
  .option("--no-color", "Disable colors")
  .action(cmdCheck);

cli
  .command("badge [file]", "Write the legendary ✓ works-on-my-machine badge (SVG)")
  .option("--fingerprint", "Include this machine's fingerprint on the badge")
  .option("--label <text>", "Right-side text (default: my machine)")
  .action((file: string | undefined, flags: { fingerprint?: boolean; label?: string } & Flags) => {
    const fp = flags.fingerprint ? captureReport(flags).fingerprint : undefined;
    const svg = renderBadge({ label: flags.label, fingerprint: fp });
    const out = resolve(file ?? "womm.svg");
    writeFileSync(out, svg, "utf8");
    process.stdout.write(`\n  Wrote ${out}\n  Embed it:  ![works on my machine](./womm.svg)\n\n`);
  });

cli.command("doctor", "Show what the project declares vs what you have").action(async () => {
  const project = readProject(process.cwd());
  const lines = [
    `  engines.node     ${project.enginesNode ?? "—"}`,
    `  engines.npm      ${project.enginesNpm ?? "—"}`,
    `  packageManager   ${project.packageManager ?? "—"}`,
    `  node pin         ${project.nvmrc ?? project.toolVersionsNode ?? "—"}`,
    `  lockfiles        ${project.lockfiles.join(", ") || "—"}`,
  ];
  process.stdout.write(`\n${lines.join("\n")}\n\n  Run \`womm check\` to validate this machine against these.\n\n`);
});

cli.help();
cli.version(VERSION);

try {
  cli.parse();
} catch (err) {
  fail((err as Error).message);
}
