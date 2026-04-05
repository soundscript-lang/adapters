# adapters

Explicit adapter packages for Soundscript local-source transformation.

This repo contains:

- `@soundscript/register`
- `@soundscript/vite`
- `@soundscript/webpack-loader`
- `@soundscript/bun-plugin`

These packages contain the actual host integration code and consume
`@soundscript/soundscript/project-transform` from the core `soundscript` repo.

Development checks:

- `npm test` validates package manifests and npm tarball contents
- `npm run test:smoke` validates the adapter packages against a release-candidate core tarball with Node, Vite, webpack, and optionally Bun
- `npm run release:publish` publishes the four public adapter packages in repo-defined order
- `npm pack --dry-run ./packages/<name>` is still useful for ad hoc package inspection

`npm run test:smoke` expects an environment variable pointing at a tarball built from the
core repo:

- `SOUNDSCRIPT_CANONICAL_TARBALL`

Set `SOUNDSCRIPT_SMOKE_REQUIRE_BUN=1` to fail if the `bun` binary is not available.

Release flow:

1. Confirm `@soundscript/soundscript` is already published for the target version.
2. Run `npm test`.
3. Optionally run `npm run test:smoke` against the release-candidate core tarballs.
4. Publish with `npm run release:publish`.

Set `SOUNDSCRIPT_NPM_OTP=<code>` or `NPM_CONFIG_OTP=<code>` for non-interactive publish.
