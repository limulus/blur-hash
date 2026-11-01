# @limulus/blur-hash Helper Guide

## Commands

```bash
# The gate: eslint, vitest with coverage, and tsc. Run it after making changes — it is
# exactly what pre-push and CI run, so green here means green there.
npm run verify

# Autofix lint. Run it first, then re-run verify — never concurrently with it, since it
# rewrites the same files verify is reading.
npm run lint:fix

# Test (single file)
npx vitest run src/lib/blur-hash.spec.ts

npm run build     # emit dist/esm and dist/types via the native compiler
npm run clean     # remove dist, coverage, *.tsbuildinfo
npm run tscc      # typecheck only
```

## TypeScript Setup

Node runs `.ts` files directly via type stripping (v22.18+/v24), so imports name the real
file: `import x from './x.ts'`. Only the erasable subset of TypeScript survives that —
`erasableSyntaxOnly` is on to enforce it at compile time. It forbids:

- `enum` declarations — use an `as const` object plus a derived union type instead:

  ```ts
  export const Direction = { Up: 1, Right: 2, Down: 3, Left: 4 } as const
  export type Direction = (typeof Direction)[keyof typeof Direction]
  ```

- Parameter properties (`constructor(readonly foo: string) {}`) — declare the field and
  assign it in the constructor body
- `namespace` with runtime code, and `import =` aliases

`verbatimModuleSyntax` is also on, so any imported name used only as a type needs the `type`
keyword. Prefer inline specifiers over a separate statement:
`import { foo, type Bar } from './baz.ts'`.

### Two tsconfigs

`tsconfig.json` is a single noEmit project over `src/**` (specs included) plus the root
config files — it is what `tscc`, editors, and typed lint use. `tsconfig.build.json` emits
`dist/` from non-spec `src/`. Keep them independent: a project reference from
`tsconfig.json` to the build config would make every typecheck emit `dist/`. The cost of
this split is that diagnostics raised only during declaration emit surface in
`npm run build` (CI runs it after `verify`), not in `tscc`.

### Two TypeScript packages

Typechecking and building run the TypeScript 7 native compiler through the `typescript-7`
npm alias, invoked by explicit path (`node node_modules/typescript-7/bin/tsc`) because both
packages ship a `tsc` bin and would collide on `.bin/tsc`. typescript-eslint deliberately
stays on the stable `typescript` package — it has no native-compiler support until the
stable API in TS 7.1. Don't "simplify" this arrangement.

## Testing

- **BDD with 100% coverage** — no exceptions. Prefer assertions over defensive programming;
  if you think you need a `/* v8 ignore … */`, pause and confirm with the user first
- **RSpec-style nesting** — `describe` for subject/context, `it('should …')` for assertions.
  No Given/When/Then
- **Avoid `vi.mock()`** — prefer tests that exercise real dependencies, and mock at the
  network layer (MSW) when you need to isolate from HTTP
- **Use the `.test` TLD for made-up hosts**, as in `https://cdn.test/…`, not a real CDN or
  site. It's reserved and never resolves, so a spec that only parses a URL can't be mistaken
  for one that goes out over the internet. In documentation, such as the README and JSDoc,
  use `.example` instead, which is reserved for that
- **vitest 4 constructs mock implementations with `new`.** An arrow function is not
  constructable, so `vi.fn().mockImplementation(() => ({ … }))` throws when the subject
  calls `new`. Supply the shape via `Mock.prototype`, or use a `function` expression when
  the implementation needs to throw
- **Tests run in Vitest browser mode**, in Playwright's headless Chromium and WebKit, so
  custom elements, workers, image loading and decoding are all real. Install the browsers
  once with `npx playwright install chromium webkit`
- **Firefox runs only in CI**, where `CI` is set. Playwright's Firefox build calls itself
  Firefox, so on macOS it uses the Firefox app's data folder,
  `~/Library/Application Support/Firefox`. Once the Firefox app has created that folder,
  macOS restricts it to Mozilla's signed app (`com.apple.macl`), so Playwright's build can't
  read `profiles.ini` and exits with "Could not find profile folder". If Firefox does launch
  on your machine, run it locally with `CI=1 npx vitest run --project firefox`. This is
  [microsoft/playwright#42768](https://github.com/microsoft/playwright/issues/42768), fixed
  in Firefox 158 and due in Playwright 1.65: once that ships, upgrade, drop the `CI`
  condition in `vitest.config.ts`, and add `firefox` to the install command above
- **Coverage comes from Chromium alone.** V8 coverage only works there, so `npm test` runs
  Chromium with coverage, then WebKit and Firefox without it. Name each browser with its own
  `--project`: a negated filter like `'!chromium'` keeps every instance, since Vitest
  matches it against the parent project's name first
- **Coverage can't see inside a worker.** V8 coverage in browser mode only covers the page,
  so `worker.spec.ts` imports `src/lib/worker.ts` on the page, where `self` is the window,
  and calls the `onmessage` handler it sets directly. Keep `worker.ts` to message plumbing;
  decoding lives in `src/lib/decode.ts`, which specs call directly
- **The worker is created once per page**, on the first decode, so if a spec needs a
  different `BlurHash.workerUrl`, put it in its own file. `blur-hash-load-race.spec.ts` does
  this with `src/mocks/gated-worker.ts`, the real worker holding its results until the spec
  releases them
- **When a browser test fails, Vitest saves a screenshot** under `__screenshots__/` next to
  the spec; those are gitignored

## Code Style Guidelines

- **ESM**: Use ES Modules (`import/export`, not `require()`)
  - Use the `node:` prefix for Node.js built-ins
- **File Extensions**: Always include `.ts` in relative imports
- **Typing**: Use strict TypeScript typing, prefer interfaces for object types
  - Prefer explicit types over inference for public APIs
- **Semicolons**: Do not use semicolons to end statements (rely on ASI)
- **Naming**:
  - Classes: PascalCase
  - Methods/variables: camelCase
  - Files: kebab-case for modules
  - Acronyms stay upper case (i.e. use `SSRFFetchOptions`, not `SsrfFetchOptions`)
- **Error Handling**: Use typed errors and proper propagation
- **Comments**:
  - Only add comments to explain _why_ code is doing something unusual or non-obvious
  - Avoid comments that merely describe _what_ the code is doing (the code already shows
    that)
  - Use JSDoc for public API documentation where appropriate
- Don't re-invent the wheel — prefer a well-used npm package over your own implementation
  that may miss important edge cases

## Project Structure

- `src/lib/` — core functionality
- `src/lib/worker.ts` — the decode worker, published separately as
  `@limulus/blur-hash/worker` for bundlers that don't bundle workers themselves
- `src/mocks/` — test fixtures and the gated worker (not covered, not public)
- `src/index.ts` — the public API barrel; anything not re-exported here is internal
- `src/define.ts` — the `@limulus/blur-hash/define` entry: the barrel, plus
  `BlurHash.define()`

## Committing

Do not run `git commit` unless the user has explicitly asked you to. The user reviews diffs
before they go in — landing work without a review denies them that step. Finishing a task
means the working tree is clean of uncommitted _unintended_ changes and `npm run verify`
passes; staging and committing is a separate, user-initiated step.

## Commit Message Guidelines

Versions of this software are automatically determined by `semantic-release`. Follow
`conventionalcommits.org` standard, specifically the `@commitlint/config-conventional`
format.

- `feat: msg`: features
- `fix: msg`: bug fixes
- `refactor: msg`: code improvements that do not affect functionality
- `test: msg`: changes in tests only, does not affect functionality
- `docs: msg`: changes to documentation
- `ci: msg`: build pipeline
- `chore: msg`: updating dependencies, miscellany
- Breaking changes to exposed API surfaces must be documented with a footer/trailer. For
  example:

  ```
  feat: remove the `POST /api/spline/reticulate` endpoint

  BREAKING CHANGE: Support for previously deprecated spline reticulation
    has been removed. Use `POST /api/spline/frobnicate` instead.
  ```

- Scopes may also be used:
  - `feat(ui): increase button roundness`
  - `docs(readme): add frobnication section`
  - `chore(dev-deps): update dev dependencies`
  - `chore(deps): update dependencies`

Only certain commit messages will trigger changes to the semantic version of the software:

- A breaking change will trigger a major version bump, regardless of the prefix
- The `feat` prefix bumps the minor version
- The `fix` prefix bumps the patch version
- All other commit messages have no effect on the version
