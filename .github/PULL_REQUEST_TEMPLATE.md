## What and why

<!-- What does this change, and which issue does it fix? For a significant feature, link the discussion where it was agreed. -->

## AI use

<!-- If an AI agent wrote any of this, name the model and the harness, for example "Written by Claude Opus 5.5 in Claude Code". Otherwise write "None". -->

## Checks

- [ ] `pnpm check`, `pnpm test` and `pnpm test:api` pass
- [ ] CSS changes: `pnpm build` and `pnpm test:visual` pass, and I looked at the report
- [ ] Color changes: the contrast probe passes (see `AGENTS.md`)
- [ ] User-facing changes: the matching page in `docs/` is updated, and the website docs in [rusticstack/pico-reforged-website](https://github.com/rusticstack/pico-reforged-website) have an issue or pull request
- [ ] I edited `src/` or `scripts/data/`, not the generated files or `css/`
