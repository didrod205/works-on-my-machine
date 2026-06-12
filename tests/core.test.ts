import { describe, it, expect } from "vitest";
import { buildReport, parseReport, diffReports, fingerprintFacts } from "../src/core.js";
import { sha256 } from "../src/sha256.js";
import type { Fact } from "../src/types.js";

const f = (key: string, value: string, section: Fact["section"] = "tools"): Fact => ({
  key,
  value,
  section,
  label: key,
});

describe("sha256", () => {
  it("matches known test vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // multi-block + non-ASCII
    expect(sha256("a".repeat(1000))).toHaveLength(64);
    expect(sha256("한글 테스트 🚀")).toHaveLength(64);
  });
});

describe("fingerprint", () => {
  it("is stable across fact order", () => {
    const a = fingerprintFacts([f("b", "2"), f("a", "1")]);
    const b = fingerprintFacts([f("a", "1"), f("b", "2")]);
    expect(a).toBe(b);
    expect(a).toMatch(/^womm:[0-9a-f]{8}$/);
  });
  it("changes when a value changes", () => {
    expect(fingerprintFacts([f("a", "1")])).not.toBe(fingerprintFacts([f("a", "2")]));
  });
});

describe("buildReport / parseReport", () => {
  it("round-trips through JSON", () => {
    const r = buildReport([f("runtime.node", "20.0.0", "runtime")], "2026-06-12");
    const parsed = parseReport(JSON.stringify(r));
    expect(parsed.fingerprint).toBe(r.fingerprint);
    expect(parsed.facts).toEqual(r.facts);
  });
  it("rejects non-reports with friendly errors", () => {
    expect(() => parseReport("not json")).toThrow(/not JSON/i);
    expect(() => parseReport('{"hello":1}')).toThrow(/Not a womm report/i);
  });
});

describe("diffReports", () => {
  const a = buildReport(
    [f("runtime.node", "20.12.2", "runtime"), f("os.memory", "16 GB", "os"), f("env.CI", "true", "env")],
    "2026-06-12",
  );
  const b = buildReport(
    [f("runtime.node", "22.3.0", "runtime"), f("os.memory", "16 GB", "os"), f("tools.git", "2.50.1", "tools")],
    "2026-06-12",
  );
  const d = diffReports(a, b);

  it("finds changed and one-sided facts, counts matches", () => {
    expect(d.same).toBe(false);
    expect(d.matching).toBe(1); // os.memory
    const keys = d.entries.map((e) => e.key).sort();
    expect(keys).toEqual(["env.CI", "runtime.node", "tools.git"]);
  });
  it("sorts critical first and attaches the why-note", () => {
    expect(d.entries[0]!.key).toBe("runtime.node");
    expect(d.entries[0]!.severity).toBe("critical");
    expect(d.entries[0]!.note).toMatch(/V8/);
  });
  it("declares identical reports same", () => {
    const d2 = diffReports(a, parseReport(JSON.stringify(a)));
    expect(d2.same).toBe(true);
    expect(d2.entries).toHaveLength(0);
  });
});
