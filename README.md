# eslint-plugin-simple-import-sort

Easy autofixable import sorting.

- ✔️ Runs via `eslint --fix` – no new tooling
- ✔️ Also sorts exports where possible
- ✔️ Handles comments
- ✔️ Handles [Flow type imports] \(via [babel-eslint])
- ✔️ [TypeScript] friendly \(via [@typescript-eslint/parser])
- ✔️ [Prettier] friendly
- ✔️ [eslint-plugin-import] friendly
- ✔️ `git diff` friendly
- ✔️ 100% code coverage
- ❌ [Does not support `require`][no-require]

This is for those who use `eslint --fix` (autofix) a lot and want to completely forget about sorting imports!

[@typescript-eslint/parser]: https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/parser
[babel-eslint]: https://github.com/babel/babel-eslint
[eslint-plugin-import]: https://github.com/benmosher/eslint-plugin-import/
[flow type imports]: https://flow.org/en/docs/types/modules/
[no-require]: https://github.com/lydell/eslint-plugin-simple-import-sort/#does-it-support-require
[prettier]: https://prettier.io/
[typescript]: https://www.typescriptlang.org/

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Example](#example)
- [Installation](#installation)
- [Usage](#usage)
- [Example configuration](#example-configuration)
- [Sort order](#sort-order)
- [Custom grouping](#custom-grouping)
- [Comment and whitespace handling](#comment-and-whitespace-handling)
- [FAQ](#faq)
  - [Does it support `require`?](#does-it-support-require)
  - [Why sort on `from`?](#why-sort-on-from)
  - [Is sorting imports/exports safe?](#is-sorting-importsexports-safe)
  - [The sorting autofix causes some odd whitespace!](#the-sorting-autofix-causes-some-odd-whitespace)
  - [Can I use this without autofix?](#can-i-use-this-without-autofix)
  - [How do I use eslint-ignore for this rule?](#how-do-i-use-eslint-ignore-for-this-rule)
  - [The plugin is called simple-<em>import</em>-sort – why does it deal with exports as well?](#the-plugin-is-called-simple-emimportem-sort--why-does-it-deal-with-exports-as-well)
- [Development](#development)
  - [npm scripts](#npm-scripts)
  - [Directories](#directories)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
<!-- prettier-ignore-end -->

## Example

<!-- prettier-ignore -->
```js
import React from "react";
import Button from "../Button";

import styles from "./styles.css";
import type { User } from "../../types";
import { getUser } from "../../api";

import PropTypes from "prop-types";
import classnames from "classnames";
import { truncate, formatNumber } from "../../utils";
```

⬇️

<!-- prettier-ignore -->
```js
import classnames from "classnames";
import PropTypes from "prop-types";
import React from "react";

import { getUser } from "../../api";
import type { User } from "../../types";
import { formatNumber, truncate } from "../../utils";
import Button from "../Button";
import styles from "./styles.css";
```

[More examples][examples]

## Installation

First you need to install [ESLint]:

```
npm install --save-dev eslint
```

Next, install `eslint-plugin-simple-import-sort`:

```
npm install --save-dev eslint-plugin-simple-import-sort
```

## Usage

Add `simple-import-sort` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["simple-import-sort"]
}
```

Then add the rule:

```json
{
  "rules": {
    "simple-import-sort/sort": "error"
  }
}
```

Make sure to remove or disable other sorting rules, such as [sort-imports] and [import/order].

```json
{
  "rules": {
    "sort-imports": "off",
    "import/order": "off"
  }
}
```

Since this plugin does not support [sorting `require`][no-require], you might want to enable some other sorting rule only for files that use `require`:

```json
{
  "overrides": [
    {
      "files": "server/**/*.js",
      "rules": {
        "simple-import-sort/sort": "off",
        "import/order": ["error", { "newlines-between": "always" }]
      }
    }
  ]
}
```

## Example configuration

This example uses [eslint-plugin-import], which is optional.

It is recommended to also set up [Prettier], to help formatting your imports (and all other code) nicely.

```json
{
  "parserOptions": {
    "sourceType": "module"
  },
  "env": { "es6": true },
  "plugins": ["simple-import-sort", "import"],
  "rules": {
    "simple-import-sort/sort": "error",
    "sort-imports": "off",
    "import/first": "error",
    "import/newline-after-import": "error",
    "import/no-duplicates": "error"
  },
  "overrides": [
    {
      "files": "server/**/*.js",
      "env": { "node": true },
      "rules": {
        "simple-import-sort/sort": "off",
        "import/order": ["error", { "newlines-between": "always" }]
      }
    }
  ]
}
```

- `simple-import-sort/sort` is turned on by default.
- The standard [sort-imports] rule is turned off, in case you extend a config that includes it.
- [import/first] makes sure all imports are at the top of the file. (autofixable)
- [import/newline-after-import] makes sure there’s a newline after the imports. (autofixable)
- [import/no-duplicates] merges import statements of the same file. (autofixable, mostly)
- For Node.js code, `simple-import-sort/sort` is turned off and replaced with [import/order] for sorting of `require` calls.

With the above configuration, you don’t need to scroll to the top of the file to add another import. Just put it above your function! ESLint will then snap it into place (at the top of the file, in order, and without duplicates).

## Sort order

This plugin is supposed to be used with autofix, ideally directly in your editor via an ESLint extension, or with [`eslint --fix`][eslint-fix] otherwise.

This section is for learning how the sorting works, not for how to manually fix errors. Use autofix!

**TL;DR:** First group, then sort alphabetically.

First, the plugin finds all _chunks_ of imports and exports. A “chunk” is a sequence of import and export statements with only comments and whitespace between. Each chunk is sorted separately. Use [import/first] if you want to make sure that all imports end up in the same chunk. There is a similar rule [import/exports-last] that groups all exports at the end of the file.

Each chunk is split into sections with a blank line between each.

1. Imports (for example `import a from "a"`).
2. Re-exports (for example `export { a } from "a"`).
3. Other exports (for example `export const a = 5`). These are not sorted internally (because they have no `from` string and can have side-effects).

Then, each section is _grouped_ into sub-sections with a blank line between each.

1. `import "./setup"`: Side effect imports. These are not sorted internally. (Exports don’t have this concept.)
2. `import react from "react"`: Packages (npm packages and Node.js builtins).
3. `import a from "/a"`: Absolute imports and other imports such as Vue-style `@/foo`.
4. `import a from "./a"`: Relative imports.

Note: The above groups are very loosely defined. See [Custom grouping] for more information.

Within each section, the imports are sorted alphabetically on the `from` string (see also [“Why sort on `from`?”][sort-from]). Keep it simple! It helps looking at the code here:

```js
const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compare(a, b) {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}
```

In other words, the imports/exports within groups are sorted alphabetically, case-insensitively and treating numbers like a human would, falling back to good old character code sorting in case of ties. See [Intl.Collator] for more information.

Since “.” sorts before “/”, relative imports/exports of files higher up in the directory structure come before closer ones – `"../../utils"` comes before `"../utils"`. Perhaps surprisingly though, `".."` would come before `"../../utils"` (since shorter substrings sort before longer strings). For that reason there’s one addition to the alphabetical rule: `"."` and `".."` are treated as `"./"` and `"../"`.

If both `import type` _and_ regular imports are used for the same source, the type imports come first.

Example:

```js
// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";
import fs from "fs";
import b from "https://example.com/script.js";

// Absolute imports and other imports.
import Error from "@/components/error.vue";
import c from "/";
import d from "/home/user/foo";

// Relative imports.
import e from "../..";
import f from "../../Utils"; // Case insensitive.
import type { B } from "../types";
import typeof C from "../types";
import g from ".";
import h from "./constants";
import i from "./styles";

// Package re-exports.
export * from "an-npm-package";
export { readFile } from "fs";
export * as ns from "https://example.com/script.js";

// Absolute and other re-exports.
export { Error } from "@/components/error.vue";
export { c } from "/";
export { d } from "/home/user/foo";

// Relative re-exports.
export { e } from "../..";
export { f } from "../../Utils"; // Case insensitive.
export { g } from ".";
export { h } from "./constants";
export { i } from "./styles";

// Other exports. (These are not sorted internally.)
export var one = 1;
export let two = 2;
export const three = 3;
export function f() {}
export class C {}
export type T = string;
export { a, b as c };
export type { T, U as V };
export default whatever;
```

Regardless of group, imported/exported items are sorted like this:

```js
import {
  // First, type imports (`export { type x, typeof y }` is a syntax error).
  type x,
  typeof y,
  // Numbers are sorted by their numeric value:
  img1,
  img2,
  img10,
  // Then everything else, alphabetically:
  k,
  L, // Case insensitive.
  m as anotherName, // Sorted by the “external interface” name “m”, not “anotherName”.
  m as tie, // But do use the file-local name in case of a tie.
  n,
} from "./x";
```

Exported items are sorted even for exports _without_ `from` (even though the whole export statement itself isn’t sorted in relation to other exports):

```js
export {
  k,
  L, // Case insensitive.
  anotherName as m, // Sorted by the “external interface” name “m”, not “anotherName”.
  tie as m, // But do use the file-local name in case of a tie.
  n,
};
export type { A, B, A as C };
```

At first it might sound counter-intuitive that `a as b` is sorted by `a` for imports, but by `b` for exports. The reason for doing it this way is to pick the most “stable” name. In `import { a as b } from "./some-file.js"`, the `as b` part is there to avoid a name collision in the file without having to change `some-file.js`. In `export { b as a }`, the `b as` part is there to aviod a name collison in the file without having to change the exported interface of the file.

## Custom grouping

For a long time, this plugin used to have no options, which helped keeping it simple.

While the human alphabetical sorting and comment handling seems to work for a lot of people, grouping of imports/exports is more difficult. Projects differ too much to have a one-size-fits-all grouping.

However, the default grouping is fine for many use cases! Don’t bother learning how custom grouping works unless you _really_ need it.

> If you’re looking at custom grouping because you want to move `src/Button`, `@company/Button` and similar – also consider using names that do not look like npm packages, such as `@/Button` and `~company/Button`. Then you won’t need to customize the grouping at all, and as a bonus things might be less confusing for other people working on the code base.
>
> In the future, it would be cool if the plugin could automatically detect your “first party”/“absolute” imports for TypeScript projects by reading your tsconfig.json – see [issue #31].

There is **one** option (and I would really like it to stay that way!) called `groups` that allows you to:

- Move `src/Button`, `@company/Button` and similar out of the (third party) “packages” group, into their own group.
- Move `react` first.
- Remove blank lines between groups.
- Make a separate group for Node.js builtins.
- Make a separate group for style imports.
- Separate `./` and `../` imports/exports.
- Not use groups at all and only sort alphabetically.

`groups` is an array of arrays of strings:

```ts
type Options = {
  groups: Array<Array<string>>;
};
```

Each string is a regex (with the `u` flag) and defines a group. (Remember to escape backslashes – it’s `"\\w"`, not `"\w"`, for example.)

Each `import` is matched against _all_ regexes on the `from` string. The import ends up in the group with **the longest match.** In case of a tie, the first matching group wins.

> If an import ends up in the wrong group – try making the desired group regex match more of the `from` string, or use negative lookahead (`(?!x)`) to exclude things from other groups.

Imports/exports that don’t match any regex are grouped together last.

Side effect imports have `\u0000` prepended to their `from` string. You can match them with `"^\\u0000"`.

The inner arrays are joined with one newline; the outer arrays are joined with two (creating a blank line). There’s _always_ a blank line between imports, re-exports and other exports.

Every group is sorted internally as mentioned in [Sort order]. Side effect imports are always placed first in the group and keep their internal order. It’s recommended to keep side effect imports in their own group.

These are the default groups:

```js
[
  // Side effect imports. (Exports don’t have this concept.)
  ["^\\u0000"],
  // Packages.
  // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
  ["^@?\\w"],
  // Absolute and other imports/exports such as Vue-style `@/foo`.
  // Anything that does not start with a dot.
  ["^[^.]"],
  // Relative imports/exports.
  // Anything that starts with a dot.
  ["^\\."],
];
```

The astute reader might notice that the above regexes match more than their comments say. For example, `"@config"` and `"_internal"` are matched as packages, but none of them are valid npm package names. `".foo"` is matched as relative, but what does `".foo"` even mean? There’s little gain in having more specific rules, though. So keep it simple!

See the [examples] for inspiration.

## Comment and whitespace handling

When an import/export is moved through sorting, its comments are moved with it. Comments can be placed above an import/export (except the first one – more on that later), or at the start or end of its line.

Example:

<!-- prettier-ignore -->
```js
// comment before import chunk
/* c1 */ import c from "c"; // c2
// b1
import b from "b"; // b2
// a1

/* a2
 */ import a /* a3 */ from "a"; /* a4 */ /* not-a
*/ // comment after import chunk
```

⬇️

<!-- prettier-ignore -->
```js
// comment before import chunk
// a1
/* a2
 */ import a /* a3 */ from "a"; /* a4 */ 
// b1
import b from "b"; // b2
/* c1 */ import c from "c"; // c2
/* not-a
*/ // comment after import chunk
```

Now compare these two examples:

```js
// @flow
import b from "b";
// a
import a from "a";
```

```js
// eslint-disable-next-line import/no-extraneous-dependencies
import b from "b";
// a
import a from "a";
```

The `// @flow` comment is supposed to be at the top of the file (it enables [Flow] type checking for the file), and isn’t related to the `"b"` import. On the other hand, the `// eslint-disable-next-line` comment _is_ related to the `"b"` import. Even a documentation comment could be either for the whole file, or the first import. So this plugin can’t know if it should move comments above the first import or not (but it knows that the `//a` comment belongs to the `"a"` import).

For this reason, comments above and below chunks of imports/exports are never moved. You need to do so yourself, if needed.

Comments around imported/exported items follow similar rules – they can be placed above an item, or at the start or end of its line. Comments before the first item or newline stay at the start, and comments after the last item stay at the end.

<!-- prettier-ignore -->
```js
import { // comment at start
  /* c1 */ c /* c2 */, // c3
  // b1

  b as /* b2 */ renamed
  , /* b3 */ /* a1
  */ a /* not-a
  */ // comment at end
} from "wherever";
import {
  e,
  d, /* d */ /* not-d
  */ // comment at end after trailing comma
} from "wherever2";
import {/* comment at start */ g, /* g */ f /* f */} from "wherever3";
```

⬇️

<!-- prettier-ignore -->
```js
import { // comment at start
/* a1
  */ a, 
  // b1
  b as /* b2 */ renamed
  , /* b3 */ 
  /* c1 */ c /* c2 */// c3
/* not-a
  */ // comment at end
} from "wherever";
import {
  d, /* d */   e,
/* not-d
  */ // comment at end after trailing comma
} from "wherever2";
import {/* comment at start */ f, /* f */g/* g */ } from "wherever3";
```

If you wonder what’s up with the strange whitespace – see [“The sorting autofix causes some odd whitespace!”][odd-whitespace]

Speaking of whitespace – what about blank lines? Just like comments, it’s difficult to know where blank lines should go after sorting. This plugin went with a simple approach – all blank lines in chunks of imports/exports are removed, except in `/**/` comments and the blank lines added between the groups mentioned in [Sort order].

(Since blank lines are removed, you might get slight incompatibilities with the [lines-around-comment] and [padding-line-between-statements] rules – I don’t use those myself, but I think there should be workarounds.)

The final whitespace rule is that this plugin puts one import/export per line. I’ve never seen real projects that intentionally puts several imports on the same line.

## FAQ

### Does it support `require`?

No. This is intentional to keep things simple. Use some other sorting rule, such as [import/order], for sorting `require`.

### Why sort on `from`?

Some other import sorting rules sort based on the first name after `import`, rather than the string after `from`. This plugin intentionally sorts on the `from` string to be `git diff` friendly.

Have a look at this example:

```js
import { productType } from "./constants";
import { truncate } from "./utils";
```

Now let’s say you need the `arraySplit` util as well:

```js
import { productType } from "./constants";
import { arraySplit, truncate } from "./utils";
```

If the imports were sorted based on the first name after `import` (“productType” and “arraySplit” in this case), the two imports would now swap order:

```js
import { arraySplit, truncate } from "./utils";
import { productType } from "./constants";
```

On the other hand, if sorting based on the `from` string (like this plugin does), the imports stay in the same order. This prevents the imports/exports from jumping around as you add and remove things, keeping your git history clean and reducing the risk of merge conflicts.

### Is sorting imports/exports safe?

Mostly.

Imports and re-exports can have side effects in JavaScript, so changing the order of them can change the order that those side effects execute in. It is best practice to _either_ import a module for its side effects _or_ for the things it exports (and _never_ rely on side effects from re-exports).

```js
// An `import` that runs side effects:
import "some-polyfill";

// An `import` that gets `someUtil`:
import { someUtil } from "some-library";
```

Imports that are only used for side effects stay in the input order. These won’t be sorted:

```js
import "b";
import "a";
```

Imports that _both_ export stuff _and_ run side effects are rare. If you run into such a situation – try to fix it, since it will confuse everyone working with the code. If that’s not possible, it’s possible to **[ignore (parts of) sorting][example-ignore].**

Another small caveat is that you sometimes need to move comments manually – see [Comment and whitespace handling][comment-handling].

For completeness, sorting the imported/exported _items_ of an import/export is always safe:

```js
import { c, b, a } from "wherever";
// Equivalent to:
import { a, b, c } from "wherever";
```

Note: `import {} from "wherever"` is _not_ treated as a side effect import.

### The sorting autofix causes some odd whitespace!

You might end up with slightly weird spacing, for example a missing space after a comma:

<!-- prettier-ignore -->
```js
import {bar, baz,foo} from "example";
```

Sorting is the easy part of this plugin. Handling whitespace and comments is the hard part. The autofix might end up with a little odd spacing around an import/export sometimes. Rather than fixing those spaces by hand, I recommend using [Prettier] or enabling other autofixable ESLint whitespace rules. See [examples] for more information.

The reason the whitespace can end up weird is because this plugin re-uses and moves around already existing whitespace rather than removing and adding new whitespace. This is to stay compatible with other ESLint rules that deal with whitespace.

### Can I use this without autofix?

Not really. The error message for this rule is literally “Run autofix to sort these imports!” Why? To actively encourage you to use autofix, and not waste time on manually doing something that the computer does a lot better. I’ve seen people painstakingly fixing cryptic (and annoying!) sorting errors from other rules one by one, not realizing they could have been autofixed. Finally, not trying to make more detailed messages makes the code of this plugin _much_ easier to work with.

### How do I use eslint-ignore for this rule?

Looking for `/* eslint-disable */` for this rule? Read all about **[ignoring (parts of) sorting][example-ignore].**

### The plugin is called simple-<em>import</em>-sort – why does it deal with exports as well?

Imports wouldn’t be much of a feature without exports. `import { A } from "a"` and `export { A } from "a"` are super similar. If you like sorting one of them, why wouldn’t you want to sort the other?

By sorting exports in the same plugin, we can re-use the advanced comment handling. And you only need to configure the “groups” option once.

## Development

You need [Node.js] ~12 and npm 6.

### npm scripts

- `npx jest --watch`: Run [Jest] tests in watch mode.
- `npm run doctoc`: Run [doctoc] on README.md.
- `npm run prettier`: Autoformat files with [Prettier].
- `npm run eslint`: Autofix [ESLint] errors.
- `npm run eslint:examples`: Used by `test/examples.test.js`.
- `npm test`: Check that everything works.
- `npm publish`: Publish to [npm], but only if `npm test` passes.

### Directories

- `src/`: Source code.
- `examples/`: Examples, tested in `test/examples.test.js`.
- `test/`: [Jest] tests.

## License

[MIT](LICENSE)

[comment-handling]: #comment-and-whitespace-handling
[custom grouping]: #custom-grouping
[doctoc]: https://github.com/thlorenz/doctoc/
[eslint-fix]: https://eslint.org/docs/user-guide/command-line-interface#--fix
[eslint]: https://eslint.org/
[example-ignore]: https://github.com/lydell/eslint-plugin-simple-import-sort/blob/master/examples/ignore.js
[examples]: https://github.com/lydell/eslint-plugin-simple-import-sort/blob/master/examples/.eslintrc.js
[flow]: https://flow.org/
[import/exports-last]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/exports-last.md
[import/first]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/first.md
[import/first]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/first.md
[import/newline-after-import]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/newline-after-import.md
[import/no-duplicates]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md
[import/order]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/order.md
[intl.collator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
[issue #31]: https://github.com/lydell/eslint-plugin-simple-import-sort/issues/31
[jest]: https://jestjs.io/
[lines-around-comment]: https://eslint.org/docs/rules/lines-around-comment
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[odd-whitespace]: #the-sorting-autofix-causes-some-odd-whitespace
[padding-line-between-statements]: https://eslint.org/docs/rules/padding-line-between-statements
[sort order]: #sort-order
[sort-from]: #why-sort-on-from
[sort-imports]: https://eslint.org/docs/rules/sort-imports
