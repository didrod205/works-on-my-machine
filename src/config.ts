import type { Config } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  extraTools: [],
  envAllowlist: [],
  includeHost: false,
};

export const CONFIG_FILENAMES = ["womm.config.json", ".wommrc.json"];

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

export function parseConfig(raw: unknown): Partial<Config> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Config> = {};
  const extraTools = asStringArray(o["extraTools"]);
  if (extraTools) out.extraTools = extraTools;
  const envAllowlist = asStringArray(o["envAllowlist"]);
  if (envAllowlist) out.envAllowlist = envAllowlist;
  if (typeof o["includeHost"] === "boolean") out.includeHost = o["includeHost"];
  return out;
}

export function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    extraTools: override.extraTools ?? base.extraTools,
    envAllowlist: override.envAllowlist ?? base.envAllowlist,
    includeHost: override.includeHost ?? base.includeHost,
  };
}
