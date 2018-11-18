# eslint-plugin-simple-import-sort [![Build Status][travis-badge]][travis-link]

Easy autofixable import sorting.

- ✔️ Runs via `eslint --fix` – no new tooling
- ✔️ Handles comments
- ✔️ Handles [Flow type imports]
- ✔️ Handles [webpack loader syntax]
- ✔️ [Prettier] friendly
- ✔️ [eslint-plugin-import] friendly
- ✔️ `git diff` friendly
- ✔️ 100% code coverage
- ✅ No configuration
- ❌ [Does not support `require`][no-require]

## Contents

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Example](#example)
- [Installation](#installation)
- [Usage](#usage)
- [Example configuration](#example-configuration)
- [Sort order](#sort-order)
- [Comment and whitespace handling](#comment-and-whitespace-handling)
- [FAQ](#faq)
  - [Does it support `require`?](#does-it-support-require)
  - [Why sort on `from`?](#why-sort-on-from)
  - [Is sorting imports safe?](#is-sorting-imports-safe)
  - [The sorting autofix causes some odd whitespace!](#the-sorting-autofix-causes-some-odd-whitespace)
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
import PropTypes from "prop-types";
import Button from "../Button";
import classnames from "classnames";

import { getUser } from "../../api";
import type { User } from "../../types";
import styles from "./styles.css";
import { truncate, formatNumber } from "../../utils";
```

⬇️

<!-- prettier-ignore -->
```js
import type { User } from "../../types";

import classnames from "classnames";
import PropTypes from "prop-types";
import React from "react";

import { getUser } from "../../api";
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

**Note:** If you installed ESLint globally (using the `-g` flag) then you must
also install `eslint-plugin-simple-import-sort` globally.

## Usage

Add `simple-import-sort` to the plugins section of your `.eslintrc`
configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["simple-import-sort"]
}
```

Then add the import sort rule:

```json
{
  "rules": {
    "simple-import-sort/sort": "error"
  }
}
```

Make sure to remove or disable other sorting rules, such as [sort-imports] and
[import/order].

```json
{
  "rules": {
    "sort-imports": "off",
    "import/order": "off"
  }
}
```

Since this plugin does not support [sorting `require`][no-require], you might
want to enable some other sorting rule only for files that use `require`:

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

This example uses the following extra plugins:

- [eslint-plugin-prettier]
- [eslint-plugin-import]

```json
{
  "parserOptions": {
    "sourceType": "module"
  },
  "env": { "es6": true },
  "plugins": ["simple-import-sort", "prettier", "import"],
  "rules": {
    "simple-import-sort/sort": "error",
    "sort-imports": "off",
    "prettier/prettier": "error",
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

## Sort order

This plugin is supposed to be used with autofix, ideally directly in your editor
via an ESLint extension, or with [`eslint --fix`][eslint-fix] otherwise.

This section is for learning how the sorting works, not for how to manually fix
errors. Use autofix!

**TL;DR:** First group, then sort alphabetically.

First, the plugin finds all _chunks_ of imports. A “chunk” is a sequence of
import statements with only comments and whitespace between. Each chunk is
sorted separately. Use [import/first] if you want to make sure that all imports
end up in the same chunk.

Then, each chunk is _grouped_ into sections with a blank line between each.

1. `import type { A } from "A"`: [Flow type imports] \(`type` first, then
   `typeof`)
2. `import "./setup"`: Side effect imports. (These are not sorted internally.)
3. `import react from "react"`: Packages and full URLs.
4. `import a from "/a"`: Absolute imports.
5. `import a from "./a"`: Relative imports.

Within each section, the imports are sorted alphabetically on the `from` string
like [`array.sort()`][array-sort] works. Keep it simple! See also [“Why sort on
`from`?”][sort-from].

Since “.” sorts before “/”, relative imports of files higher up in the directory
structure come before closer ones – `"../../utils"` comes before `"../utils"`.
Perhaps surprisingly though, `".."` would come before `"../../utils"` (since
shorter substrings sort before longer strings). For that reason there’s one
addition to the alphabetical rule: sources ending with `.` or `./` are sorted
_after_ other sources with the same prefix.

Within [Flow type imports], the imports are also sub-grouped with packages
first, followed by absolute imports, followed by relative imports.

[webpack loader syntax] is stripped before sorting, so `"loader!a"` sorts before
`"b"`. (If two source are equal after stripping the loader syntax, the one with
loader syntax comes last.)

Example:

<!-- prettier-ignore -->
```js
// Flow type imports.
import type A from "A";
import type { C } from "./types";
import typeof B from "B";

// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Packages and full URLs.
import a from "an-npm-package";
import b from "https://example.com/script.js";

// Absolute imports.
import c from "/";
import d from "/home/user/foo";

// Relative imports.
import e from "../../utils";
import f from "../..";
import g from "./constants";
import h from "./styles";
import i from "html-loader!./text.html";
import j from ".";

// Regardless of group, imported items are sorted like this:
import {
  // First, Flow type imports.
  type x,
  typeof y,
  // Then everything else, alphabetically:
  k,
  l,
  m as anotherName, // Sorted by the original name “m”, not “anotherName”.
  n,
} from "wherever";
```

<!--
Workaround to make the next section to appear in the table of contents.
```js
```
-->

## Comment and whitespace handling

When an import is moved through sorting, it’s comments are moved with it.
Comments can be placed above an import (except the first one – more on that
later), or at the start or end of its line.

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

The `// @flow` comment is supposed to be at the top of the file (it enables
[Flow] type checking for the file), and isn’t related to the `"b"` import. On
the other hand, the `// eslint-disable-next-line` comment _is_ related to the
`"b"` import. Even a documentation comment could be either for the whole file,
or the first import. So this plugin can’t know if it should move comments above
the first import or not (but it knows that the `//a` comment belongs to the
`"a"` import).

For this reason, comments above and below chunks of imports are never moved. You
need to do so yourself, if needed.

Comments around imported items follow similar rules – they can be placed above
an item, or at the start or end of its line. Comments before the first item or
newline stay at the start, and comments after the last item stay at the end.

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

If you wonder what’s up with the strange whitespace – see [“The sorting autofix
causes some odd whitespace!”][odd-whitespace]

Speaking of whitespace – what about blank lines? Just like comments, it’s
difficult to know where blank lines should go after sorting. This plugin went
with a simple approach – all blank lines in chunks of imports are removed,
except in `/**/` comments and the blank lines added between the groups mentioned
in [Sort order].

(Since blank lines are removed, you might get slight incompatibilities with the
[lines-around-comment] and [padding-line-between-statements] rules – I don’t use
those myself, but I think there should be workarounds.)

The final whitespace rule is that this plugin puts one import per line, with no
indentation. I’ve never seen imports written any other way.

## FAQ

### Does it support `require`?

No. This is intentional to keep things simple. Use some other sorting rule, such
as [import/order], for sorting `require`.

### Why sort on `from`?

Some other import sorting rules sort based on the first name after `import`,
rather than the string after `from`. This plugin intentionally sorts on the
`from` string to be `git diff` friendly.

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

If the imports were sorted based on the first name after `import` (“productType”
and “arraySplit” in this case), the two imports would now swap order:

```js
import { arraySplit, truncate } from "./utils";
import { productType } from "./constants";
```

On the other hand, if sorting based on the `from` string (like this plugin
does), the imports stay in the same order. This prevents the imports from
jumping around as you add and remove things, keeping your git history clean and
reducing the risk of merge conflicts.

### Is sorting imports safe?

Mostly.

Imports can have side effects in JavaScript, so changing the order of the
imports can change the order that those side effects execute in. It is best
practice to _either_ import a module for its side effects _or_ for the things it
exports.

```js
// An `import` that runs side effects:
import "some-polyfill";

// An `import` that gets `someUtil`:
import { someUtil } from "some-library";
```

Imports that are only used for side effects stay in the input order. These won’t
be sorted:

```js
import "b";
import "a";
```

Imports that _both_ export stuff _and_ run side effects are rare. If you run
into such a situation – try to fix it, since it will confuse everyone working
with the code. If that’s not possible, it’s possible to **[ignore (parts of)
sorting][example-ignore].**

Another small caveat is that you sometimes need to move comments manually – see
[Comment and whitespace handling][comment-handling].

For completeness, sorting the imported _items_ of an import is always safe:

```js
import { c, b, a } from "wherever";
// Equivalent to:
import { a, b, c } from "wherever";
```

### The sorting autofix causes some odd whitespace!

You might end up with slightly weird spacing, for example a missing space after
a comma:

<!-- prettier-ignore -->
```js
import {bar, baz,foo} from "example";
```

Sorting is the easy part of this plugin. Handling whitespace and comments is the
hard part. The autofix might end up with a little odd spacing around an import
sometimes. Rather than fixing those spaces by hand, I recommend using [Prettier]
or enabling other autofixable ESLint whitespace rules. See [examples] for more
information.

The reason the whitespace can end up weird is because this plugin re-uses and
moves around already existing whitespace rather than removing and adding new
whitespace. This is to stay compatible with other ESLint rules that deal with
whitespace.

## Development

You can need [Node.js] 10 and npm 6.

### npm scripts

- `npm run eslint`: Run [ESLint] \(including [Prettier]).
- `npm run eslint:fix`: Autofix [ESLint] errors.
- `npm run eslint:examples`: Used by `test/examples.test.js`.
- `npm run prettier`: Run [Prettier] for files other than JS.
- `npm run doctoc`: Run [doctoc] on README.md.
- `npm run jest`: Run unit tests. During development, `npm run jest -- --watch`
  is nice.
- `npm run coverage`: Run unit tests with code coverage.
- `npm test`: Check that everything works.
- `npm publish`: Publish to [npm], but only if `npm test` passes.

### Directories

- `src/`: Source code.
- `examples/`: Examples, tested in `test/examples.test.js`.
- `test/`: [Jest] tests.

## License

[MIT](LICENSE)

<!-- prettier-ignore-start -->
[array-sort]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
[comment-handling]: #comment-and-whitespace-handling
[doctoc]: https://github.com/thlorenz/doctoc/
[eslint-fix]: https://eslint.org/docs/user-guide/command-line-interface#--fix
[eslint-plugin-import]: https://github.com/benmosher/eslint-plugin-import/
[eslint-plugin-prettier]: https://github.com/prettier/eslint-plugin-prettier
[eslint]: https://eslint.org/
[example-ignore]: https://github.com/lydell/eslint-plugin-simple-import-sort/blob/master/examples/ignore.js
[examples]: https://github.com/lydell/eslint-plugin-simple-import-sort/blob/master/examples/.eslintrc.js
[flow type imports]: https://flow.org/en/docs/types/modules/
[flow]: https://flow.org/
[import/first]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/first.md
[import/order]: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/order.md
[jest]: https://jestjs.io/
[lines-around-comment]: https://eslint.org/docs/rules/lines-around-comment
[no-require]: #does-it-support-require
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[odd-whitespace]: #the-sorting-autofix-causes-some-odd-whitespace
[padding-line-between-statements]: https://eslint.org/docs/rules/padding-line-between-statements
[prettier]: https://prettier.io/
[sort order]: #sort-order
[sort-from]: #why-sort-on-from
[sort-imports]: https://eslint.org/docs/rules/sort-imports
[travis-badge]: https://travis-ci.com/lydell/eslint-plugin-simple-import-sort.svg?branch=master
[travis-link]: https://travis-ci.com/lydell/eslint-plugin-simple-import-sort
[webpack loader syntax]: https://webpack.js.org/concepts/loaders/#inline
<!-- prettier-ignore-end -->
