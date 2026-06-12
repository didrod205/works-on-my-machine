import { describe, it, expect } from "vitest";
import { satisfies, parseVersion, compare } from "../src/semver.js";

describe("parseVersion", () => {
  it("parses plain, v-prefixed, partial, prerelease, build", () => {
    expect(parseVersion("18.17.1")).toEqual({ major: 18, minor: 17, patch: 1, pre: null });
    expect(parseVersion("v20")).toEqual({ major: 20, minor: 0, patch: 0, pre: null });
    expect(parseVersion("1.2.3-rc.1+build5")?.pre).toBe("rc.1");
    expect(parseVersion("not-a-version")).toBeNull();
  });
});

describe("compare", () => {
  it("orders versions and ranks prereleases below releases", () => {
    const v = (s: string) => parseVersion(s)!;
    expect(compare(v("1.2.3"), v("1.2.4"))).toBe(-1);
    expect(compare(v("2.0.0"), v("1.9.9"))).toBe(1);
    expect(compare(v("1.0.0-rc.1"), v("1.0.0"))).toBe(-1);
    expect(compare(v("1.0.0"), v("1.0.0"))).toBe(0);
  });
});

describe("satisfies", () => {
  it("handles >= and ranges that appear in engines fields", () => {
    expect(satisfies("18.17.1", ">=18")).toBe(true);
    expect(satisfies("16.20.0", ">=18")).toBe(false);
    expect(satisfies("20.5.0", ">=18 <21")).toBe(true);
    expect(satisfies("22.0.0", ">=18 <21")).toBe(false);
  });
  it("handles caret and tilde", () => {
    expect(satisfies("18.19.0", "^18.17.0")).toBe(true);
    expect(satisfies("19.0.0", "^18.17.0")).toBe(false);
    expect(satisfies("18.17.9", "~18.17.0")).toBe(true);
    expect(satisfies("18.18.0", "~18.17.0")).toBe(false);
    expect(satisfies("0.2.5", "^0.2.3")).toBe(true);
    expect(satisfies("0.3.0", "^0.2.3")).toBe(false);
  });
  it("handles wildcards, OR, hyphen ranges, and exact", () => {
    expect(satisfies("18.4.2", "18.x")).toBe(true);
    expect(satisfies("19.0.0", "18.x")).toBe(false);
    expect(satisfies("20.1.0", "^18.17.0 || ^20.3.0")).toBe(false);
    expect(satisfies("20.9.0", "^18.17.0 || ^20.3.0")).toBe(true);
    expect(satisfies("16.5.0", "14 - 16")).toBe(true);
    expect(satisfies("18.17.1", "18.17.1")).toBe(true);
    expect(satisfies("18.17.2", "=18.17.1")).toBe(false);
    expect(satisfies("99.0.0", "*")).toBe(true);
  });
  it("returns null (not false) for syntax it can't read", () => {
    expect(satisfies("18.0.0", "weird-range-syntax!!!")).toBeNull();
    expect(satisfies("garbage", ">=18")).toBeNull();
  });
});
