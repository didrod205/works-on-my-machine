# Changelog

All notable changes to womm are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-06-12

### Added

- First public release.
- `womm` capture: Node (version + provenance: nvm/fnm/volta/asdf/homebrew/system),
  npm/pnpm/yarn/bun, npm registry, project facts (engines, packageManager,
  .nvmrc/.tool-versions, lockfile type + content hash, node_modules presence),
  interesting env vars (values masked), timezone/locale, common tools, OS.
- Privacy at capture time: home/username → `~`, env values never recorded
  (presence + length only) outside a small allowlist, hostname opt-in as a
  salted hash, token-shaped strings scrubbed. Zero network code.
- `womm diff` (and `womm <report.json>` shorthand): severity-ranked differences
  with one-line "why this matters" notes; exit 1 when environments differ.
- `womm check`: engines/.nvmrc/packageManager/lockfile/registry/NODE_ENV rules
  with fixes; non-zero exit for CI and onboarding gates.
- `womm report` (womm.json + collapsed paste-safe womm.md), `womm badge`
  (the legendary SVG, optional fingerprint), `womm doctor`.
- Pure, dependency-free, browser-safe core: report parse/build/fingerprint
  (built-in SHA-256), diff engine, verdict rules, tiny semver-range checker.

[0.1.0]: https://github.com/didrod205/works-on-my-machine/releases/tag/v0.1.0
