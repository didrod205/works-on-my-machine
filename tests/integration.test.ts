import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { parseReport, diffReports } from "../src/core.js";
import { capture, readProject } from "../src/probes.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { renderBadge } from "../src/badge.js";
import { diffToMarkdown, reportToMarkdown } from "../src/report/markdown.js";

const ciRaw = readFileSync(new URL("../examples/ci-linux.json", import.meta.url), "utf8");
const devRaw = readFileSync(new URL("../examples/dev-mac.json", import.meta.url), "utf8");

describe("integration: fixture diff (CI linux vs dev mac)", () => {
  const d = diffReports(parseReport(ciRaw), parseReport(devRaw));

  it("finds exactly the planted differences", () => {
    expect(d.same).toBe(false);
    expect(d.entries).toHaveLength(14);
    expect(d.matching).toBe(5);
  });
  it("ranks the five environment-breaking diffs as critical, first", () => {
    const crit = d.entries.filter((e) => e.severity === "critical").map((e) => e.key).sort();
    expect(crit).toEqual([
      "env.NODE_ENV",
      "packageManager.npm",
      "packageManager.registry",
      "project.lockfile.hash",
      "runtime.node",
    ]);
    expect(d.entries.slice(0, 5).every((e) => e.severity === "critical")).toBe(true);
  });
  it("renders a markdown table with why-notes", () => {
    const md = diffToMarkdown(d, "ci", "dev");
    expect(md).toContain("| 🔴 | Node | `20.12.2` | `22.3.0` |");
    expect(md).toContain("Why these matter");
  });
});

describe("integration: real capture on a temp project", () => {
  it("captures this machine without leaking the home dir, and reads project facts", () => {
    const dir = mkdtempSync(join(tmpdir(), "womm-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture-app", version: "1.0.0", engines: { node: ">=18" } }),
      );
      writeFileSync(join(dir, ".nvmrc"), "20.11.1\n");
      writeFileSync(join(dir, "yarn.lock"), "# fake lock\n");

      const { facts, actual, project } = capture(dir, DEFAULT_CONFIG);

      // node facts are real
      expect(actual.nodeVersion).toBe(process.version.replace(/^v/, ""));
      const node = facts.find((f) => f.key === "runtime.node");
      expect(node?.value).toBe(actual.nodeVersion);

      // project facts picked up
      expect(project.enginesNode).toBe(">=18");
      expect(project.nvmrc).toBe("20.11.1");
      expect(project.lockfiles).toEqual(["yarn.lock"]);
      expect(facts.some((f) => f.key === "project.lockfile.hash")).toBe(true);

      // PRIVACY: no fact value contains the raw home directory or username
      const home = homedir();
      for (const f of facts) {
        expect(f.value.includes(home), `${f.key} leaked home dir: ${f.value}`).toBe(false);
      }
      // hostname absent by default
      expect(facts.some((f) => f.key === "os.host")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("readProject tolerates broken package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "womm-"));
    try {
      writeFileSync(join(dir, "package.json"), "{ not json");
      const p = readProject(dir);
      expect(p.enginesNode).toBeUndefined();
      expect(p.lockfiles).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("badge + report markdown", () => {
  it("renders a valid badge with custom label and fingerprint", () => {
    const svg = renderBadge({ label: "ubuntu 24.04", fingerprint: "womm:12ab34cd" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("✓ works on");
    expect(svg).toContain("ubuntu 24.04 · womm:12ab34cd");
    expect(svg).not.toContain("<script");
  });
  it("report markdown is a details block with the fingerprint", () => {
    const md = reportToMarkdown(parseReport(ciRaw));
    expect(md).toContain("<details>");
    expect(md).toContain("womm:");
    expect(md).toContain("| Node | `20.12.2` |");
  });
});
