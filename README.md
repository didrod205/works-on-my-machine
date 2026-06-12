<div align="center">

# ✓ works on my machine

### The most famous excuse in software — finally with receipts.

[![npm version](https://img.shields.io/npm/v/but-it-works-on-my-machine.svg?color=success)](https://www.npmjs.com/package/but-it-works-on-my-machine)
[![CI](https://github.com/didrod205/works-on-my-machine/actions/workflows/ci.yml/badge.svg)](https://github.com/didrod205/works-on-my-machine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/but-it-works-on-my-machine.svg)](https://www.npmjs.com/package/but-it-works-on-my-machine)
[![license](https://img.shields.io/npm/l/but-it-works-on-my-machine.svg)](./LICENSE)
&nbsp;
<img src="./examples/badge.svg" alt="works on my machine" />

```bash
npx but-it-works-on-my-machine
```

*(yes, that's the real command — after `npm i -g` it's just `womm`)*

*Capture a paste-safe fingerprint of your dev environment → diff it against a
teammate's (or CI) → get told **exactly what's different and why it broke.***

</div>

---

Every bug thread has the same three messages:

> **them:** it crashes on start
> **you:** works on my machine 🤷
> **them:** …well it doesn't on mine

That conversation has wasted more engineering hours than any compiler error in
history — because nobody can see *what's actually different* between the two
machines. `envinfo` tells you what **you** have. **womm tells you what's
*different*, and which difference is probably the bug.**

## The killer move: `womm diff`

You run `npx but-it-works-on-my-machine report` and attach `womm.json` to the
issue. They run:

```bash
npx but-it-works-on-my-machine your-womm.json   # diff their machine against yours
```

```
  14 differences · 5 matching · ci-linux womm:1c612ba0 vs this machine womm:a7405ec3

  ● NODE_ENV       production vs —
    └ NODE_ENV changes dependency installs (dev deps) and framework behavior.
  ● npm            10.5.0 vs 10.8.1
    └ Different package-manager versions resolve dependency trees differently.
  ● npm registry   https://registry.npmjs.org/ vs https://npm.corp.acme.dev/
    └ A non-default registry can serve different (or stale, or proxied) packages.
  ● Lockfile hash  sha256:a1b2c3d4e5f6 vs sha256:f9e8d7c6b5a4
    └ Lockfiles differ — you are literally not running the same dependencies.
  ● Node           20.12.2 vs 22.3.0
    └ Different Node majors/minors run different V8, different APIs, different bugs.
  ○ Timezone       UTC vs Asia/Seoul
  ○ Locale         en-US vs ko-KR

  ▲ 5 critical differences — start there.
```

Differences are **ranked by how often they're the actual culprit** — Node
version, package-manager version, registry, lockfile drift, `NODE_ENV` — each
with a one-line *why this matters*. No more eyeballing two walls of `envinfo`.

## What it captures (and what it never does)

```
  ✓ works on my machine  ·  womm:2fce9e48  2026-06-12
  🔒 captured locally · paths masked · env values hidden · nothing uploaded

  Runtime           Node 25.9.0 · from homebrew (/opt/homebrew/bin/node)
  Package manager   npm 11.12.1 · pnpm 10.33.2 · registry npmjs.org
  Project           womm@0.1.0 · engines >=18 · package-lock.json (sha256:929a…)
  Environment       NODE_ENV? · TZ Asia/Seoul · locale en-US
  Tools             git 2.50.1 · docker 29.5.2 · python3 3.14.4
  System            darwin 25.4.0 · arm64 · zsh
```

**Privacy is enforced at capture time, not display time:**

- home directory & username → `~` everywhere
- env var **values are never recorded** (only "set, N chars") except a tiny safe
  allowlist (`NODE_ENV`, `TZ`, `CI`…)
- hostname is **off by default** (opt-in `--include-host` stores a salted hash)
- a last-line-of-defense scrubber redacts anything token-shaped
- **zero network code in the package** — grep `dist/`, it's all local

So the report is safe to paste into a public GitHub issue. That's the point.

## `womm check` — stop "wrong Node" before it wastes a morning

Verifies **this machine** against what the repo *declares* — and exits non-zero
on violations, so it works as an onboarding gate or CI step:

```
  ✗ This project declares engines.node "^18.17.0" but you're running 25.9.0.
    fix: Switch Node (e.g. `nvm install 18.17.0`).
  ✗ The repo pins Node 20.11.1 (.nvmrc/.tool-versions) but you're on 25.9.0.
    fix: Run `nvm use` (or `asdf install`) in the repo root.
  ⚠ Multiple lockfiles present (package-lock.json, yarn.lock) — two installs
    can disagree about every version.
```

Rules: `engines.node`/`engines.npm` (real semver-range check), `.nvmrc` /
`.node-version` / `.tool-versions` vs the active Node, the `packageManager`
field vs what's installed, lockfile↔package-manager mismatches, multiple
lockfiles, non-default registries, and a globally-set `NODE_ENV=production`.

```jsonc
// package.json — make "works on my machine" a guarantee instead of an excuse
{ "scripts": { "preinstall": "npx --yes but-it-works-on-my-machine check" } }
```

## The badge 🏅

In loving memory of the [2007 certification program](https://blog.codinghorror.com/the-works-on-my-machine-certification-program/):

```bash
npx but-it-works-on-my-machine badge                 # → womm.svg
npx but-it-works-on-my-machine badge --fingerprint   # …with your fingerprint, as receipts
```

<img src="./examples/badge.svg" alt="works on my machine badge" /> &nbsp; ← embed it in your README. You've earned it.

## Install

```bash
npx but-it-works-on-my-machine        # no install — yes, the package name is the excuse
npm i -g but-it-works-on-my-machine   # installs the short commands: womm + works-on-my-machine
```

> The npm name is long because npm's similarity filter reserves the short ones —
> consider it a feature: the command *is* the meme.

Node ≥ 18. macOS / Linux / Windows. Zero-dependency core (the CLI uses `cac` + `picocolors`).

## All commands

<sub>(`womm` = the installed bin; with npx, prefix `npx but-it-works-on-my-machine …`)</sub>

```bash
womm                        # capture & pretty-print this machine
womm --md | --json          # also write womm.md / womm.json (with --quiet: print raw)
womm report                 # write womm.json + womm.md to attach to an issue
womm their-report.json      # diff this machine against a report (shorthand)
womm diff a.json b.json     # diff two reports
womm check                  # validate vs engines/.nvmrc/packageManager/lockfile → exit code
womm badge [file]           # the legendary badge
womm doctor                 # what the project declares, at a glance
```

`womm.config.json` (optional): `{ "extraTools": ["terraform", "ffmpeg"], "envAllowlist": ["MY_FLAG"], "includeHost": false }`

## For maintainers: a better bug-report block

Issue templates have asked for `npx envinfo` output for years.
`npx but-it-works-on-my-machine --quiet --md` prints a **collapsed, paste-safe
details block** — and unlike a wall of text, the reporter's JSON can be
**diffed against yours** in one command:

```md
<!-- ISSUE_TEMPLATE/bug_report.md -->
Run `npx but-it-works-on-my-machine --quiet --md` and paste the output below.
```

Triaging then becomes: download their `womm.json` → `npx but-it-works-on-my-machine their.json`
→ the critical differences are at the top, explained.

## Library API

The diff/verdict engine is pure and browser-safe:

```ts
import { parseReport, diffReports, runVerdicts, satisfies } from "but-it-works-on-my-machine";

const d = diffReports(parseReport(a), parseReport(b));
d.entries[0]; // { key: "runtime.node", a: "20.12.2", b: "22.3.0", severity: "critical", note: "…" }
```

## Roadmap

- 🌐 **Web diff playground** — paste two reports, see the verdict, 100% client-side.
- 🧰 More ecosystems: Python (`.python-version`, `uv.lock`), Ruby, Rust toolchains.
- 🤝 `womm diff --gh <issue-url>` — pull the reporter's block straight from a GitHub issue.
- 🔌 Verdict plugins (your org's "it's always the proxy" rule).

## 💖 Sponsor

Free, MIT, built in spare time. If womm ended a "works on my machine" argument for you:

- ⭐ **Star the repo** — it's how the next person finds it mid-argument.
- 🍋 **[Sponsor via Lemon Squeezy](https://elab-studio.lemonsqueezy.com/checkout/buy/5d059b89-51d0-456b-b33a-ed56994f7010)** — one-time or recurring.

## License

[MIT](./LICENSE) © womm contributors
