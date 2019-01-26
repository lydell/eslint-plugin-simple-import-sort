### Version 2.1.0 (2019-01-26)

- Added: [TypeScript] support, via [@typescript-eslint/parser].

### Version 2.0.0 (2018-11-30)

- Changed: [Flow type imports] are no longer put in their own group at the top.
  Type imports from npm packages are grouped among regular npm imports, relative
  type imports are group among regular relative imports, and so on. The reason
  for this change is the same as for [sorting on `from`] – to avoid import
  “jumps” when they change. Previously, changing
  `import type { User } from "./user"` into
  `import { type User, getUser } from "./user"` caused the line to jump from the
  top of the file (the type imports group) to further down (the relative imports
  group). Now it stays in the relative imports group in both cases.

### Version 1.0.2 (2018-11-18)

- Update readme.

### Version 1.0.1 (2018-11-18)

- Update readme.

### Version 1.0.0 (2018-11-18)

- Initial release.

<!-- prettier-ignore-start -->
[@typescript-eslint/parser]: https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/parser
[flow type imports]: https://flow.org/en/docs/types/modules/
[sort-from]: README.md#why-sort-on-from
[typescript]: https://www.typescriptlang.org/
<!-- prettier-ignore-end -->
