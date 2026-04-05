# Contributing

Use pull requests against `main` for public adapter changes.

Before opening a pull request:

- run `npm test`
- run `npm run test:smoke` when the change affects release-candidate or host integration behavior

Keep adapter changes narrowly scoped to the host integration they affect, and
open or reference an issue first for broader release-surface changes.
