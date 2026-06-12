import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { Config } from "./types.js";
import { DEFAULT_CONFIG, CONFIG_FILENAMES, parseConfig, mergeConfig } from "./config.js";

export interface LoadedConfig {
  config: Config;
  path: string | null;
}

function findConfigFile(startDir: string, explicit?: string): string | null {
  if (explicit) {
    const abs = resolve(startDir, explicit);
    return existsSync(abs) ? abs : null;
  }
  let dir = resolve(startDir);
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(startDir: string, explicit?: string): LoadedConfig {
  const file = findConfigFile(startDir, explicit);
  if (!file) {
    if (explicit) throw new Error(`Config file not found: ${explicit}`);
    return { config: DEFAULT_CONFIG, path: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Could not parse config ${file}: ${(err as Error).message}`);
  }
  return { config: mergeConfig(DEFAULT_CONFIG, parseConfig(parsed)), path: file };
}
