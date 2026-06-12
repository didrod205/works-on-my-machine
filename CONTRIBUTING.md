# Contributing to womm

Thanks for your interest! The most welcome contributions: a **new verdict rule**
("this difference breaks builds and here's why"), a **new probe** (another
runtime/tool worth capturing), or better **diff severity** mappings.

## Getting started

```bash
git clone https://github.com/didrod205/works-on-my-machine.git
cd works-on-my-machine
npm install
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/
npm run example     # diff the two bundled fixture machines
```

## Project layout

```
src/
  core.ts        # report build/parse/fingerprint + the diff engine (pure)
  verdicts.ts    # "why it broke" rules: actual env vs project declarations (pure)
  semver.ts      # tiny range checker for engines fields (pure)
  sha256.ts      # pure SHA-256 (fingerprints work in the browser too)
  mask.ts        # privacy: path masking, env-value hiding, host hashing, scrubber
  badge.ts       # the legendary SVG badge
  probes.ts      # node-only: gather facts from THIS machine (time-boxed, no network)
  report/        # console / markdown renderers
  config.ts      # pure defaults/parse/merge   load-config.ts # fs loading
  cli.ts         # cac CLI (womm / works-on-my-machine)
tests/           # vitest specs incl. fixture diff + real-capture privacy test
examples/        # two fixture machines (ci-linux / dev-mac) + the badge
```

## Non-negotiables

- **Paste-safety.** Reports are designed for public issues. Nothing personally
  identifying may enter a Fact: paths masked, env values hidden, hostnames
  opt-in & hashed. The integration test asserts no fact contains the home dir —
  keep it green, and extend it when you add probes.
- **No network code.** Ever. The whole pitch is local.
- **Deterministic core.** `core.ts`/`verdicts.ts`/`semver.ts` stay pure (no
  `node:*`), so the diff engine runs in a browser.
- **Honest verdicts.** A rule must describe documented behavior (cite it in the
  PR). A wrong "why it broke" is worse than none: `satisfies()` returns `null`
  for ranges it can't read — treat that as "can't tell", never "violation".

## Adding a verdict rule

Add it to `runVerdicts()` in priority order with a stable `id`, a `level`
(`fail` = will break, `warn` = can break), a one-line message, and a `fix` when
one exists. Add a firing test and a non-firing test in `tests/verdicts.test.ts`.

## Adding a probe

Probes are best-effort: missing tool → no fact (never an error), 4s timeout,
output normalized to a short version string, value passed through `scrubValue`.
Mask any path with `maskPath` before it enters a fact.
