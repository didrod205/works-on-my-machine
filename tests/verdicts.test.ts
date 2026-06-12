import { describe, it, expect } from "vitest";
import { runVerdicts, parsePackageManagerField } from "../src/verdicts.js";
import type { ActualEnv, ProjectDeclarations } from "../src/types.js";

const proj = (over: Partial<ProjectDeclarations> = {}): ProjectDeclarations => ({ lockfiles: [], ...over });
const env = (over: Partial<ActualEnv> = {}): ActualEnv => ({ nodeVersion: "20.12.2", npmVersion: "10.5.0", ...over });

const ids = (v: ReturnType<typeof runVerdicts>) => v.map((x) => x.id);

describe("parsePackageManagerField", () => {
  it("parses name@version and rejects junk", () => {
    expect(parsePackageManagerField("pnpm@9.1.0")).toEqual({ name: "pnpm", version: "9.1.0" });
    expect(parsePackageManagerField("yarn@4.2.2+sha256.abc")).toEqual({ name: "yarn", version: "4.2.2+sha256.abc" });
    expect(parsePackageManagerField("maven@3")).toBeNull();
  });
});

describe("runVerdicts", () => {
  it("passes a clean machine silently", () => {
    expect(runVerdicts(env(), proj({ enginesNode: ">=18" }))).toHaveLength(0);
  });

  it("fails engines.node violations", () => {
    const v = runVerdicts(env({ nodeVersion: "16.20.0" }), proj({ enginesNode: ">=18" }));
    expect(ids(v)).toContain("engines-node");
    expect(v[0]!.level).toBe("fail");
  });

  it("does NOT fail when the range syntax is unknown (null ≠ false)", () => {
    expect(runVerdicts(env(), proj({ enginesNode: "completely-wild!!" }))).toHaveLength(0);
  });

  it("fails a .nvmrc major mismatch but tolerates same-major drift on major-only pins", () => {
    expect(ids(runVerdicts(env({ nodeVersion: "22.3.0" }), proj({ nvmrc: "20.11.1" })))).toContain("node-pin");
    expect(runVerdicts(env({ nodeVersion: "20.99.0" }), proj({ nvmrc: "20" }))).toHaveLength(0);
    expect(ids(runVerdicts(env({ nodeVersion: "20.12.2" }), proj({ nvmrc: "v20.11.1" })))).toContain("node-pin");
  });

  it("ignores non-numeric pins like lts/iron", () => {
    expect(runVerdicts(env(), proj({ nvmrc: "lts/iron" }))).toHaveLength(0);
  });

  it("warns on packageManager version drift and fails when missing", () => {
    const drift = runVerdicts(env({ pnpmVersion: "10.0.0" }), proj({ packageManager: "pnpm@9.1.0" }));
    expect(ids(drift)).toContain("package-manager-version");
    expect(drift[0]!.level).toBe("warn");
    const missing = runVerdicts(env({ pnpmVersion: undefined }), proj({ packageManager: "pnpm@9.1.0" }));
    expect(ids(missing)).toContain("package-manager-missing");
    expect(missing[0]!.level).toBe("fail");
  });

  it("warns on multiple lockfiles and fails on lockfile/PM mismatch", () => {
    expect(ids(runVerdicts(env(), proj({ lockfiles: ["package-lock.json", "yarn.lock"] })))).toContain("multiple-lockfiles");
    const mismatch = runVerdicts(env({ yarnVersion: "4.0.0" }), proj({ packageManager: "yarn@4.0.0", lockfiles: ["pnpm-lock.yaml"] }));
    expect(ids(mismatch)).toContain("lockfile-pm-mismatch");
  });

  it("warns on a non-npmjs registry and NODE_ENV=production", () => {
    expect(ids(runVerdicts(env({ npmRegistry: "https://npm.corp.example/" }), proj()))).toContain("registry");
    expect(runVerdicts(env({ npmRegistry: "https://registry.npmjs.org/" }), proj())).toHaveLength(0);
    expect(ids(runVerdicts(env({ nodeEnv: "production" }), proj()))).toContain("node-env-production");
  });
});
