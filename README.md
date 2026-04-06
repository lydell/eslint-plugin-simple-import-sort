# eslint-plugin-simple-import-sort

Easy autofixable import sorting.

- ✅️ Runs via [`eslint --fix`][eslint-fix] – no new tooling
- ✅️ Also sorts exports where possible
- ✅️ Handles comments
- ✅️ Handles type imports/exports
- ✅️ [TypeScript] friendly \(via [@typescript-eslint/parser])
- ✅️ [Prettier] friendly
- ✅️ [dprint] friendly ([with configuration][dprint-configuration])
- ✅️ [eslint-plugin-import] friendly
- ✅️ `git diff` friendly
- ✅️ 100% code coverage
- ✅️ No dependencies
- ❌ [Does not support `require`][no-require]

This is for those who use [`eslint --fix`][eslint-fix] (autofix) a lot and want to completely forget about sorting imports!

[@typescript-eslint/parser]: https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/parser
[dprint-configuration]: https://github.com/lydell/eslint-plugin-simple-import-sort/#how-do-i-use-this-with-dprint
[dprint]: https://dprint.dev/
[eslint-fix]: https://eslint.org/docs/user-guide/command-line-interface#--fix
[eslint-plugin-import]: https://github.com/import-js/eslint-plugin-import/
[no-require]: https://github.com/lydell/eslint-plugin-simple-import-sort/#does-it-support-require
[prettier]: https://prettier.io/
[typescript]: https://www.typescriptlang.org/

## Example

<!-- prettier-ignore -->
```ts
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
```ts
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

```
npm install --save-dev eslint-plugin-simple-import-sort
```

> ℹ️ This is an [ESLint] plugin. 👉 [Getting Started with ESLint][eslint-getting-started]

## Usage

- [eslintrc]: Add `"simple-import-sort"` to the "plugins" array in your `.eslintrc.*` file, and add the rules for sorting imports and exports. By default ESLint doesn’t parse `import` syntax – the "parserOptions" is an example of how to enable that.

  ```json
  {
    "plugins": ["simple-import-sort"],
    "rules": {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error"
    },
    "parserOptions": {
      "sourceType": "module",
      "ecmaVersion": "latest"
    }
  }
  ```

- [eslint.config.js (flat config)]: Import eslint-plugin-simple-import-sort, put it in the `plugins` object, and add the rules for sorting imports and exports. With flat config, `import` syntax is enabled by default.

  ```js
  import simpleImportSort from "eslint-plugin-simple-import-sort";

  export default [
    {
      plugins: {
        "simple-import-sort": simpleImportSort,
      },
      rules: {
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
      },
    },
  ];
  ```

Make sure _not_ to use other sorting rules at the same time:

- [sort-imports]
- [import/order]

> ℹ️ Note: There used to be a rule called `"simple-import-sort/sort"`. Since version 6.0.0 it’s called `"simple-import-sort/imports"`.

## Example configuration

This example uses [eslint-plugin-import], which is optional.

It is recommended to also set up [Prettier], to help formatting your imports (and all other code) nicely.

```json
{
  "parserOptions": {
    "sourceType": "module",
    "ecmaVersion": "latest"
  },
  "plugins": ["simple-import-sort", "import"],
  "rules": {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "import/first": "error",
    "import/newline-after-import": "error",
    "import/no-duplicates": "error"
  }
}
```

- `"sourceType": "module"` and `"ecmaVersion": "latest"` are needed so ESLint doesn’t report `import` and `export` as syntax errors.
- `simple-import-sort/imports` and `simple-import-sort/exports` are turned on for all files.
- [import/first] makes sure all imports are at the top of the file. (autofixable)
- [import/newline-after-import] makes sure there’s a newline after the imports. (autofixable)
- [import/no-duplicates] merges import statements of the same file. (autofixable, mostly)

## Not for everyone

This plugin is not for everyone. Let me explain.

For a long time, this plugin used to have no options, which helped keeping it simple.

While the human alphabetical sorting and comment handling seems to work for a lot of people, grouping of imports is more difficult. Projects differ too much to have a one-size-fits-all grouping.

I’ve decided to have this single option but nothing more. Here are some things you can’t configure:

- The sorting within each group. It is what it is. See [Sorting].
- Sorting of [side effect imports][safe] (they always stay in the original order).

If you want more options, I recommend using the [import/order] rule (from [eslint-plugin-import]) instead. It has plenty of options, and the maintainers seem interested in expanding the feature where it makes sense.

Then why does this plugin exist? See [How is this rule different from `import/order`?][import/order-comparison].

If we start adding more options to this plugin, it won’t be eslint-plugin-<strong>simple</strong>-import-sort anymore. Eventually it would have no reason to exist – effort would be better spent contributing to [import/order].

I made this plugin for myself. I use it in many little projects and I like it. If you like it too – I’m very glad to hear! But _everyone_ won’t like it. And that’s ok.

## Sort order

This plugin is supposed to be used with autofix, ideally directly in your editor via an ESLint extension, or with [`eslint --fix`][eslint-fix] otherwise.

This section is for learning how the sorting works, not for how to manually fix errors. Use autofix!

**TL;DR:** First group, then sort alphabetically.

### Grouping

#### imports

First, the plugin finds all _chunks_ of imports. A “chunk” is a sequence of import statements with only comments and whitespace between. Each chunk is sorted separately. Use [import/first] if you want to make sure that all imports end up in the same chunk.

Then, each chunk is _grouped_ into sections with a blank line between each.

1. `import "./setup"`: Side effect imports. (These are not sorted internally.)
2. `import * as fs from "node:fs"`: Node.js builtin modules prefixed with `node:`.
3. `import react from "react"`: Packages (npm packages and Node.js builtins _without_ `node:`).
4. `import a from "/a"`: Absolute imports and other imports such as Vue-style `@/foo`.
5. `import a from "./a"`: Relative imports.

Note: The above groups are very loosely defined. See [Custom grouping] for more information.

#### exports

Sequences of re-exports (exports with `from`) are sorted. Other types of exports are not reordered.

Unlike imports, there’s no automatic grouping of exports. Instead a comment on its own line starts a group. This leaves the grouping up to you to do manually.

The following example has 3 groups (one with “x” and “y”, one with “a” and “b” and one with “./”):

```js
export * from "x";
export * from "y";

// This comment starts a new group.
/* This one does not. */ export * from "a"; // Neither does this one.
/* Nor this
one */ export * from "b";
/* But this one does. */
export * from "./";
```

Each group is sorted separately, and the groups themselves aren’t sorted – they stay where you wrote them.

Without the grouping comments the above example would end up like this:

```js
export * from "./";
/* This one does not. */ export * from "a"; // Neither does this one.
/* Nor this
one */ export * from "b";
export * from "x";
export * from "y";
```

### Sorting

Within each section, the imports/exports are sorted alphabetically on the `from` string (see also [“Why sort on `from`?”][sort-from]). Keep it simple! It helps looking at the code here:

```js
const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compare(a, b) {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}
```

In other words, the imports/exports within groups are sorted alphabetically, case-insensitively and treating numbers like a human would, falling back to good old character code sorting in case of ties. See [Intl.Collator] for more information. Note: `Intl.Collator` sorts punctuation in _some_ defined order. I have no idea what order punctuation sorts in, and I don’t care. There’s no ordered “alphabet” for punctuation that I know of.

There’s one addition to the alphabetical rule: Directory structure. Relative imports/exports of files higher up in the directory structure come before closer ones – `"../../utils"` comes before `"../utils"`, which comes before `"."`. (In short, `.` and `/` sort before any other (non-whitespace, non-control) character. `".."` and similar sort like `"../,"` (to avoid the “shorter prefix comes first” sorting concept).)

If both `import type` _and_ regular imports are used for the same source, the type imports come first. Same thing for `export type`. (You can move type imports to their own group, as mentioned in [custom grouping].)

If multiple import styles are used for the same source, there is a defined order:

```js
// First namespace imports:
import * as Circle from "circle;
// Then default imports:
import createCircle from "circle";
// Then named imports:
import { radius } from "circle";
```

That is especially useful if you need to have both a namespace import _and_ want to import a few things separately (since that cannot be combined into a single import statement). With the above rule, the imports end up in a deterministic order.

Finally, if there are multiple imports for the same source with the same style, it’s recommended to use [import/no-duplicates] to join them into one import.

### Example

<!-- prettier-ignore -->
```ts
// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Node.js builtins prefixed with `node:`.
import * as fs from "node:fs";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";
import fs2 from "fs";
import b from "https://example.com/script.js";

// Absolute imports and other imports.
import c from "/";
import d from "/home/user/foo";
import Error from "@/components/error.vue";

// Relative imports.
import e from "../..";
import type { B } from "../types";
import f from "../Utils"; // Case insensitive.
import g from ".";
import h from "./constants";
import i from "./styles";

// Different types of exports:
export { a } from "../..";
export { b } from "/";
export { Error } from "@/components/error.vue";
export * from "an-npm-package";
export { readFile } from "fs";
export * as ns from "https://example.com/script.js";

// This comment groups some more exports:
export { e } from "../..";
export { f } from "../Utils";
export { g } from ".";
export { h } from "./constants";
export { i } from "./styles";

// Other exports – the plugin does not touch these, other than sorting named
// exports inside braces.
export var one = 1;
export let two = 2;
export const three = 3;
export function func() {}
export class Class {}
export type Type = string;
export { named, other as renamed };
export type { T, U as V };
export default whatever;
```

Regardless of group, imported items are sorted like this:

```ts
import {
  // Numbers are sorted by their numeric value:
  img1,
  img2,
  img10,
  // Then everything else, alphabetically:
  k,
  L, // Case insensitive.
  m as anotherName, // Sorted by the “external interface” name “m”, not “anotherName”.
  m as tie, // But do use the file-local name in case of a tie.
  // Types are sorted as if the `type` keyword wasn’t there.
  type x,
  y,
} from "./x";
```

Exported items are sorted even for exports _without_ `from` (even though the whole export statement itself isn’t sorted in relation to other exports):

```ts
export {
  k,
  L, // Case insensitive.
  anotherName as m, // Sorted by the “external interface” name “m”, not “anotherName”.
  // tie as m, // For exports there can’t be ties – all exports must be unique.
  // Types are sorted as if the `type` keyword wasn’t there.
  type x,
  y,
};
export type { A, B, A as C };
```

At first it might sound counter-intuitive that `a as b` is sorted by `a` for imports, but by `b` for exports. The reason for doing it this way is to pick the most “stable” name. In `import { a as b } from "./some-file.js"`, the `as b` part is there to avoid a name collision in the file without having to change `some-file.js`. In `export { b as a }`, the `b as` part is there to avoid a name collision in the file without having to change the exported interface of the file.

<!--
Workaround to make the next section to appear in the table of contents.
```js
```
-->

## Custom grouping

There is **one** option (see [Not for everyone]) called `groups` that is useful for a bunch of different use cases.

`groups` is an array of arrays of strings:

```ts
type Options = {
  groups: Array<Array<string>>;
};
```

Each string is a regex (with the [`u` flag]). The regexes decide which imports go where. (Remember to escape backslashes – it’s `"\\w"`, not `"\w"`, for example.)

The inner arrays are joined with one newline; the outer arrays are joined with two – creating a blank line. That’s why there are two levels of arrays – it lets you choose where to have blank lines.

Here are some things you can do:

- Move non-standard import paths like `src/Button` and `@company/Button` out of the (third party) “packages” group, into their own group.
- Move `react` first.
- [Avoid blank lines between imports](#how-do-i-remove-all-blank-lines-between-imports) by using a single inner array.
- Make a separate group for style imports.
- Separate `./` and `../` imports.
- Not use groups at all and only sort alphabetically.

> If you’re looking at custom grouping because you want to move non-standard import paths like `src/Button` (with no leading `./` or `../`) and `@company/Button` – consider instead using names that do not look like npm packages, such as `@/Button` and `~company/Button`. Then you won’t need to customize the grouping at all, and as a bonus things might be less confusing for other people working on the code base.
>
> See [issue #31] for some tips on what you can do if you have very complex requirements.
>
> Note: For exports the grouping is manual using comments – see [exports].

Each `import` is matched against _all_ regexes on the `from` string. The import ends up at the regex with **the longest match.** In case of a tie, the **first** matching regex wins.

> If an import ends up in the wrong place – try making the desired regex match more of the `from` string, or use negative lookahead (`(?!x)`) to exclude things from other groups.

Imports that don’t match any regex are put together last.

Side effect imports have `\u0000` _prepended_ to their `from` string (starts with `\u0000`). You can match them with `"^\\u0000"`.

Type imports have `\u0000` _appended_ to their `from` string (ends with `\u0000`). You can match them with `"\\u0000$"` – but you probably need more than that to avoid them also being matched by other regexes.

All imports that match the same regex are sorted internally as mentioned in [Sort order].

This is the default value for the `groups` option:

```js
[
  // Side effect imports.
  ["^\\u0000"],
  // Node.js builtins prefixed with `node:`.
  ["^node:"],
  // Packages.
  // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
  ["^@?\\w"],
  // Absolute imports and other imports such as Vue-style `@/foo`.
  // Anything not matched in another group.
  ["^"],
  // Relative imports.
  // Anything that starts with a dot.
  ["^\\."],
];
```

The astute reader might notice that the above regexes match more than their comments say. For example, `"@config"` and `"_internal"` are matched as packages, but none of them are valid npm package names. `".foo"` is matched as a relative import, but what does `".foo"` even mean? There’s little gain in having more specific rules, though. So keep it simple!

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

Speaking of whitespace – what about blank lines? Just like comments, it’s difficult to know where blank lines should go after sorting. This plugin went with a simple approach – all blank lines in chunks of imports/exports are removed, except in `/**/` comments and the blank lines added between the groups mentioned in [Sort order]. (Note: For exports, blank lines between groups are completely up to you – if you have blank lines around the grouping comments they are preserved.)

(Since blank lines are removed, you might get slight incompatibilities with the [lines-around-comment] and [padding-line-between-statements] rules – I don’t use those myself, but I think there should be workarounds.)

The final whitespace rule is that this plugin puts one import/export per line. I’ve never seen real projects that intentionally puts several imports/exports on the same line.

## FAQ

### Does it support `require`?

No. This is intentional to keep things simple. Use some other sorting rule, such as [import/order], for sorting `require`. Or consider migrating your code using `require` to `import`. `import` is well supported these days.

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

On the other hand, if sorting based on the `from` string (like this plugin does), the imports stay in the same order. This prevents the imports from jumping around as you add and remove things, keeping your git history clean and reducing the risk of merge conflicts.

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

For completeness, sorting the imported/exported _items_ of an import is always safe:

```js
import { c, b, a } from "wherever";
// Equivalent to:
import { a, b, c } from "wherever";
```

Note: `import {} from "wherever"` is _not_ treated as a side effect import.

Finally, there’s one more thing to know about exports. Consider this case:

_one.js:_

```js
export const title = "One";
export const one = 1;
```

_two.js:_

```js
export const title = "Two";
export const two = 2;
```

_reexport.js:_

```js
export * from "./one.js";
export * from "./two.js";
```

_main.js:_

```js
import * as reexport from "./reexport.js";
console.log(reexport);
```

What happens if you run _main.js?_ In Node.js and browsers the result is:

```js
{
  one: 1,
  two: 2,
}
```

Note how `title` is not even present in the object! This is good for sorting, because it means that it’s safe to reorder the two `export * from` exports in _reexport.js_ – it’s not like the last import “wins” and you’d accidentally change the value of `title` by sorting.

However, this _might_ still cause issues depending on which bundler you use. Here’s how a few bundlers handled the duplicate name `title` the time of this writing:

- ✅ Webpack: Compile time error – safe.
- ✅ Parcel: Run time error – safe.
- ⚠️ Rollup: Compile time warning, but uses the first one of them so it’s potentially unsafe. It’s possible to configure Rollup to treat warnings as errors, though.
- ✅ TypeScript: Compile time error – safe.

### The sorting autofix causes some odd whitespace!

You might end up with slightly weird spacing, for example a missing space after a comma:

<!-- prettier-ignore -->
```js
import {bar, baz,foo} from "example";
```

Sorting is the easy part of this plugin. Handling whitespace and comments is the hard part. The autofix might end up with a little odd spacing around an import/export sometimes. Rather than fixing those spaces by hand, I recommend using [Prettier] or enabling other autofixable ESLint whitespace rules. See [examples] for more information.

The reason the whitespace can end up weird is because this plugin re-uses and moves around already existing whitespace rather than removing and adding new whitespace. This is to stay compatible with other ESLint rules that deal with whitespace.

### Can I use this without autofix?

Not really. The error message for this rule is literally “Run autofix to sort these imports!” Why? To actively encourage you to use [`eslint --fix`][eslint-fix] (autofix), and not waste time on manually doing something that the computer does a lot better. I’ve seen people painstakingly fixing cryptic (and annoying!) sorting errors from other rules one by one, not realizing they could have been autofixed. Finally, not trying to make more detailed messages makes the code of this plugin _much_ easier to work with.

### How do I use eslint-ignore for this rule?

Looking for `/* eslint-disable */` for this rule? Read all about **[ignoring (parts of) sorting][example-ignore].**

### How is this rule different from `import/order`?

The [import/order] rule used to not support alphabetical sorting but now it does. So what does `eslint-plugin-simple-import-sort` bring to the table?

- Sorts imported/exported items (`import { a, b, c } from "."`): [eslint-plugin-import#1787](https://github.com/import-js/eslint-plugin-import/issues/1787)
- Sorts re-exports: [eslint-plugin-import#1888](https://github.com/import-js/eslint-plugin-import/issues/1888)
- Supports comments: [eslint-plugin-import#1450](https://github.com/import-js/eslint-plugin-import/issues/1450), [eslint-plugin-import#1723](https://github.com/import-js/eslint-plugin-import/issues/1723)
- Supports type imports: [eslint-plugin-import#645](https://github.com/import-js/eslint-plugin-import/issues/645)
- Supports absolute imports: [eslint-plugin-import#512](https://github.com/import-js/eslint-plugin-import/issues/512)
- Allows choosing where side effect imports go: [eslint-plugin-import#970](https://github.com/import-js/eslint-plugin-import/issues/970)
- Allows custom ordering within groups: [eslint-plugin-import#1378](https://github.com/import-js/eslint-plugin-import/issues/1378)
- Sorts numerically (`"./img10.jpg"` sorts after `"./img2.jpg"`, not before)
- Open `import/order` issues: [import/export ordering](https://github.com/import-js/eslint-plugin-import/labels/import%2Fexport%20ordering)

Some other differences:

- This plugin gives you a single error for each chunk of imports/exports, while `import/order` can give multiple (see [Can I use this without autofix?][autofix] for details). In other words, this plugin is noisier in terms of underlined lines in your editor, while `import/order` is noisier in terms of error count.
- This plugin has a single (though very powerful) option that is a bunch of regexes, while `import/order` has bunch of different options. It’s unclear which is easier to configure. But `eslint-plugin-simple-import-sort` tries to do the maximum out of the box.

### How do I use this with `dprint`?

[dprint] also sorts imports and exports – but does not group them. Instead, it preserves your own grouping.

The first question to ask yourself is if dprint is good enough. If so, you’ve got one tool less to worry about!

If you’d like to enforce grouping, though, you could still use `eslint-plugin-simple-import-sort`. However, the two might disagree slightly on some sorting edge cases. So it’s better to turn off sorting in your dprint config file:

```json
{
  "typescript": {
    "module.sortImportDeclarations": "maintain"
  }
}
```

Source: https://dprint.dev/plugins/typescript/config/

### How do I remove all blank lines between imports?

Use [custom grouping], setting the `groups` option to only have a single inner array.

For example, here’s the default value but changed to a single inner array:

```js
[["^\\u0000", "^node:", "^@?\\w", "^", "^\\."]];
```

(By default, each string is in its _own_ array (that’s 5 inner arrays) – causing a blank line between each.)

## License

[MIT](LICENSE)

[`u` flag]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/unicode
[autofix]: #can-i-use-this-without-autofix
[comment-handling]: #comment-and-whitespace-handling
[custom grouping]: #custom-grouping
[eslint-getting-started]: https://eslint.org/docs/user-guide/getting-started
[eslint.config.js (flat config)]: https://eslint.org/docs/latest/use/configure/configuration-files-new
[eslint]: https://eslint.org/
[eslintrc]: https://eslint.org/docs/latest/use/configure/configuration-files
[example-ignore]: ./examples/ignore.js
[examples]: ./examples/.eslintrc.js
[exports]: #exports
[flow]: https://flow.org/
[import/first]: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/first.md
[import/newline-after-import]: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/newline-after-import.md
[import/no-duplicates]: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-duplicates.md
[import/order-comparison]: #how-is-this-rule-different-from-importorder
[import/order]: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/order.md
[intl.collator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
[issue #31]: https://github.com/lydell/eslint-plugin-simple-import-sort/issues/31
[lines-around-comment]: https://eslint.org/docs/rules/lines-around-comment
[not for everyone]: #not-for-everyone
[odd-whitespace]: #the-sorting-autofix-causes-some-odd-whitespace
[padding-line-between-statements]: https://eslint.org/docs/rules/padding-line-between-statements
[safe]: #is-sorting-importsexports-safe
[sort order]: #sort-order
[sort-from]: #why-sort-on-from
[sort-imports]: https://eslint.org/docs/rules/sort-imports
[sorting]: #sorting
