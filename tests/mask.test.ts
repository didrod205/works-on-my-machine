import { describe, it, expect } from "vitest";
import { maskPath, maskValue, hostTag, scrubValue } from "../src/mask.js";

describe("maskPath", () => {
  it("replaces the home dir and username variants with ~", () => {
    expect(maskPath("/Users/jane/.nvm/versions/node/v20/bin/node", "/Users/jane", "jane")).toBe(
      "~/.nvm/versions/node/v20/bin/node",
    );
    expect(maskPath("/home/jane/code:/Users/jane/bin", "/home/jane", "jane")).toBe("~/code:/Users/~/bin");
    expect(maskPath("/opt/homebrew/bin/node", "/Users/jane", "jane")).toBe("/opt/homebrew/bin/node");
  });
});

describe("maskValue", () => {
  it("shows presence and length only", () => {
    expect(maskValue("hunter2")).toBe("(set, 7 chars)");
    expect(maskValue("")).toBe("(empty)");
    expect(maskValue("supersecret")).not.toContain("supersecret");
  });
});

describe("hostTag", () => {
  it("is stable, short, and never contains the hostname", () => {
    const t = hostTag("janes-macbook-pro.local");
    expect(t).toBe(hostTag("janes-macbook-pro.local"));
    expect(t).toMatch(/^host-[0-9a-f]{6}$/);
    expect(t).not.toContain("macbook");
  });
});

describe("scrubValue (last line of defense)", () => {
  it("redacts token shapes that sneak into values", () => {
    const fake = "ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKE1234";
    expect(scrubValue(`node --token ${fake} run`)).not.toContain(fake);
    expect(scrubValue("AKIAFAKEFAKEFAKE0000")).toBe("‹redacted›");
    expect(scrubValue("plain value")).toBe("plain value");
  });
});
