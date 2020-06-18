"use strict";

const assert = require("assert");

const { RuleTester } = require("eslint");

const plugin = require("../src");

// Hack to allow using `.toMatchInlineSnapshot` for `output` in `RuleTester`.
// https://github.com/eslint/eslint/blob/7621f5d2aa7d87e798b75ca47d6889c280597e99/lib/rule-tester/rule-tester.js#L614

const originalStrictEqual = assert.strictEqual;
assert.strictEqual = (actual, expected, message) => {
  if (message === "Output is incorrect." && typeof expected === "function") {
    // Make tabs and carriage returns visible.
    const replaced = actual.replace(/\t/g, "→").replace(/\r/g, "<CR>");
    // Add pipes at the beginning of lines to make snapshots easier to read when
    // lines start with whitespace.
    const piped = replaced.includes("\n")
      ? `|${replaced}`.replace(/\n/g, "\n|")
      : replaced;
    expected(piped);
  } else {
    originalStrictEqual(actual, expected, message);
  }
};

// Make snapshots easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: (value) => typeof value === "string",
  print: (value) => value,
});

// Make multiline inputs easier to read. Every line must start with 10 spaces
// and a pipe. The spaces and the pipe are stripped away. This allows indenting
// the string, even when lines start with whitespace.
// Additionally, the string must start with a newline (with no spaces before
// it), and end with a newline (optionally followed by spaces).
function input(strings) {
  if (strings.length !== 1) {
    const loc = getLoc();
    throw new Error(
      `input: ${loc} Expected no interpolations, but got ${strings.length} separate parts.`
    );
  }

  const string = strings[0];

  if (!/^(?:\n {10}\|[^\n]*)+\n[^\S\n]*$/.test(string)) {
    const loc = getLoc();
    throw new Error(
      `input: ${loc} Every line must start with 10 spaces and a \`|\`.`
    );
  }

  return strip(string);
}

function strip(string, { keepPipes = false } = {}) {
  return (
    string
      // Remove indentation and pipes. (The pipes need to be kept in the `.toBe`
      // checks.)
      .replace(/\n *\|/g, keepPipes ? "\n|" : "\n")
      // Remove starting and ending newline (and optional spaces).
      .replace(/^\n|\n[^\S\n]*$/g, "")
  );
}

function getLoc(depth = 1) {
  const line = new Error().stack.split("\n")[depth + 2];
  const match = /\d+:\d+/.exec(line || "");
  return match != null ? match[0] : "?";
}

const baseTests = (expect) => ({
  valid: [
    // Simple cases.
    `import "a"`,
    `import a from "a"`,
    `import {a} from "a"`,
    `import a, {b} from "a"`,
    `import {a,b} from "a"`,
    `import {} from "a"`,
    `import {    } from "a"`,
    `import * as a from "a"`,
    `export {a} from "a"`,
    `export {a,b} from "a"`,
    `export {} from "a"`,
    `export {    } from "a"`,
    `export * as a from "a"`,
    `export var one = 1;`,
    `export let two = 2;`,
    `export const three = 3;`,
    `export function f() {}`,
    `export class C {}`,
    `export { a, b as c }; var a, b;`,
    `export default whatever;`,

    // Side-effect only imports are kept in the original order.
    input`
          |import "b";
          |import "a"
    `,

    // Side-effect only imports use a stable sort (issue #34).
    input`
          |import "codemirror/addon/fold/brace-fold"
          |import "codemirror/addon/edit/closebrackets"
          |import "codemirror/addon/fold/foldgutter"
          |import "codemirror/addon/fold/foldgutter.css"
          |import "codemirror/addon/lint/json-lint"
          |import "codemirror/addon/lint/lint"
          |import "codemirror/addon/lint/lint.css"
          |import "codemirror/addon/scroll/simplescrollbars"
          |import "codemirror/addon/scroll/simplescrollbars.css"
          |import "codemirror/lib/codemirror.css"
          |import "codemirror/mode/javascript/javascript"
    `,

    // Sorted alphabetically.
    input`
          |import x1 from "a";
          |import x2 from "b"
    `,
    input`
          |export {x1} from "a";
          |export {x2} from "b"
    `,
    input`
          |import x1 from "a";
          |import x2 from "b"
          |
          |export {x3} from "a";
          |export {x4} from "b"
    `,

    // Opt-out.
    input`
          |// eslint-disable-next-line
          |import x2 from "b"
          |import x1 from "a";
          |export {x4} from "b"
          |export {x3} from "a";
    `,

    // Whitespace before comment at last specifier should stay.
    input`
          |import {
          |  a, // a
          |  b // b
          |} from "specifiers-comment-space"
          |import {
          |  c, // c
          |  d, // d
          |} from "specifiers-comment-space-2"
    `,
    input`
          |export {
          |  a, // a
          |  b // b
          |} from "specifiers-comment-space"
          |export {
          |  c, // c
          |  d, // d
          |} from "specifiers-comment-space-2"
    `,

    // Accidental trailing spaces doesn’t produce a sorting error.
    input`
          |import a from "a"    
          |import b from "b";    
          |import c from "c";  /* comment */  
    `,
    input`
          |export {a} from "a"    
          |export {b} from "b";    
          |export {c} from "c";  /* comment */  
    `,
  ],

  invalid: [
    // Sorting alphabetically.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a";
          |import x2 from "b"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {x2} from "b"
          |export {x1} from "a";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {x1} from "a";
          |export {x2} from "b"
        `);
      },
      errors: 1,
    },

    // Semicolon-free code style, with start-of-line guarding semicolon.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a"
          |
          |;[].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a"
          |import x2 from "b"
          |
          |;[].forEach()
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {x2} from "b"
          |export {x1} from "a"
          |
          |;[].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {x1} from "a"
          |export {x2} from "b"
          |
          |;[].forEach()
        `);
      },
      errors: 1,
    },

    // Semicolon-free code style 2.
    {
      code: input`
          |import { foo } from "bar"
          |import a from "a"
          |
          |;(async function() {
          |  await foo()
          |})()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"
          |import { foo } from "bar"
          |
          |;(async function() {
          |  await foo()
          |})()
        `);
      },
      errors: 1,
      parserOptions: { ecmaVersion: 2018 },
    },
    {
      code: input`
          |export { foo } from "bar"
          |export {a} from "a"
          |
          |;(async function() {
          |  await foo()
          |})()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from "a"
          |export { foo } from "bar"
          |
          |;(async function() {
          |  await foo()
          |})()
        `);
      },
      errors: 1,
      parserOptions: { ecmaVersion: 2018 },
    },

    // Semicolons edge cases.
    {
      code: input`
          |import x2 from "b"
          |import x7 from "g";
          |import x6 from "f"
          |;import x5 from "e"
          |import x4 from "d" ; import x3 from "c"
          |import x1 from "a" ; [].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a" ; 
          |import x2 from "b"
          |import x3 from "c"
          |import x4 from "d" ; 
          |import x5 from "e"
          |import x6 from "f"
          |;
          |import x7 from "g";[].forEach()
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {x2} from "b"
          |export {x7} from "g";
          |export {x6} from "f"
          |;export {x5} from "e"
          |export {x4} from "d" ; export {x3} from "c"
          |export {x1} from "a" ; [].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {x1} from "a" ; 
          |export {x2} from "b"
          |export {x3} from "c"
          |export {x4} from "d" ; 
          |export {x5} from "e"
          |export {x6} from "f"
          |;
          |export {x7} from "g";[].forEach()
        `);
      },
      errors: 1,
    },

    // Comments around start-of-line guarding semicolon.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a" // a
          |
          |;/* comment */[].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a" // a
          |import x2 from "b"
          |
          |;/* comment */[].forEach()
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {x2} from "b"
          |export {x1} from "a" // a
          |
          |;/* comment */[].forEach()
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {x1} from "a" // a
          |export {x2} from "b"
          |
          |;/* comment */[].forEach()
        `);
      },
      errors: 1,
    },

    // No more code after last semicolon.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a"
          |
          |;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a"
          |;
          |import x2 from "b"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {x2} from "b"
          |export {x1} from "a"
          |
          |;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {x1} from "a"
          |;
          |export {x2} from "b"
        `);
      },
      errors: 1,
    },

    // Sorting specifiers.
    {
      code: `import { e, b, a as c } from "specifiers"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import { a as c,b, e } from "specifiers"`
        );
      },
      errors: 1,
    },
    {
      code: `export { e, b, a as c } from "specifiers"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { b, a as c,e } from "specifiers"`
        );
      },
      errors: 1,
    },
    {
      code: `export { e, b, a as c }; var e, b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a as c,b, e }; var e, v, a;`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with default import.
    {
      code: `import d, { e, b, a as c } from "specifiers-default"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import d, { a as c,b, e } from "specifiers-default"`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with trailing comma.
    {
      code: `import d, { e, b, a as c, } from "specifiers-trailing-comma"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import d, { a as c,b, e,  } from "specifiers-trailing-comma"`
        );
      },
      errors: 1,
    },
    {
      code: `export { e, b, a as c, } from "specifiers-trailing-comma"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { b, a as c,e,  } from "specifiers-trailing-comma"`
        );
      },
      errors: 1,
    },
    {
      code: `export { e, b, a as c, }; var e, b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a as c,b, e,  }; var e, b, a;`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with renames.
    {
      code: `import { a as c, a as b2, b, a } from "specifiers-renames"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,a as b2, a as c, b } from "specifiers-renames"`
        );
      },
      errors: 1,
    },
    {
      code: `export { a as c, a as b2, b, a } from "specifiers-renames"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b, a as b2, a as c } from "specifiers-renames"`
        );
      },
      errors: 1,
    },
    {
      code: `export { a as c, a as b2, b, a }; var a, b;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,a as b2, a as c, b }; var a, b;`
        );
      },
      errors: 1,
    },

    // Sorting specifiers like humans do.
    {
      code: input`
          |import {
          |  B,
          |  a,
          |  A,
          |  b,
          |  B2,
          |  bb,
          |  BB,
          |  bB,
          |  Bb,
          |  ab,
          |  ba,
          |  Ba,
          |  BA,
          |  bA,
          |  x as d,
          |  x as C,
          |  img10,
          |  img2,
          |  img1,
          |  img10_black,
          |} from "specifiers-human-sort"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  A,
          |  a,
          |  ab,
          |  B,
          |  b,
          |  B2,
          |  BA,
          |  Ba,
          |  bA,
          |  ba,
          |  BB,
          |  Bb,
          |  bB,
          |  bb,
          |  img1,
          |  img2,
          |  img10,
          |  img10_black,
          |  x as C,
          |  x as d,
          |} from "specifiers-human-sort"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  B,
          |  a,
          |  A,
          |  b,
          |  B2,
          |  bb,
          |  BB,
          |  bB,
          |  Bb,
          |  ab,
          |  ba,
          |  Ba,
          |  BA,
          |  bA,
          |  x as d,
          |  x as C,
          |  img10,
          |  img2,
          |  img1,
          |  img10_black,
          |} from "specifiers-human-sort"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  A,
          |  a,
          |  ab,
          |  B,
          |  b,
          |  B2,
          |  BA,
          |  Ba,
          |  bA,
          |  ba,
          |  BB,
          |  Bb,
          |  bB,
          |  bb,
          |  x as C,
          |  x as d,
          |  img1,
          |  img2,
          |  img10,
          |  img10_black,
          |} from "specifiers-human-sort"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  B,
          |  a,
          |  A,
          |  b,
          |  B2,
          |  bb,
          |  BB,
          |  bB,
          |  Bb,
          |  ab,
          |  ba,
          |  Ba,
          |  BA,
          |  bA,
          |  x as d,
          |  x as C,
          |  img10,
          |  img2,
          |  img1,
          |  img10_black,
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  A,
          |  a,
          |  ab,
          |  B,
          |  b,
          |  B2,
          |  BA,
          |  Ba,
          |  bA,
          |  ba,
          |  BB,
          |  Bb,
          |  bB,
          |  bb,
          |  img1,
          |  img2,
          |  img10,
          |  img10_black,
          |  x as C,
          |  x as d,
          |}
        `);
      },
      errors: 1,
    },

    // Keyword-like specifiers.
    {
      code: `import { aaNotKeyword, zzNotKeyword, abstract, as, asserts, any, async, /*await,*/ boolean, constructor, declare, get, infer, is, keyof, module, namespace, never, readonly, require, number, object, set, string, symbol, type, undefined, unique, unknown, from, global, bigint, of } from 'keyword-identifiers';`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import { aaNotKeyword, abstract, any, as, asserts, async, /*await,*/ bigint, boolean, constructor, declare, from, get, global, infer, is, keyof, module, namespace, never, number, object, of,readonly, require, set, string, symbol, type, undefined, unique, unknown, zzNotKeyword } from 'keyword-identifiers';`
        );
      },
      errors: 1,
    },
    {
      code: `export { aaNotKeyword, zzNotKeyword, abstract, as, asserts, any, async, /*await,*/ boolean, constructor, declare, get, infer, is, keyof, module, namespace, never, readonly, require, number, object, set, string, symbol, type, undefined, unique, unknown, from, global, bigint, of } from 'keyword-identifiers';`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { aaNotKeyword, abstract, any, as, asserts, async, /*await,*/ bigint, boolean, constructor, declare, from, get, global, infer, is, keyof, module, namespace, never, number, object, of,readonly, require, set, string, symbol, type, undefined, unique, unknown, zzNotKeyword } from 'keyword-identifiers';`
        );
      },
      errors: 1,
    },

    // No spaces in specifiers.
    {
      code: `import {e,b,a as c} from "specifiers-no-spaces"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import {a as c,b,e} from "specifiers-no-spaces"`
        );
      },
      errors: 1,
    },
    {
      code: `export {e,b,a as c} from "specifiers-no-spaces"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export {b,a as c,e} from "specifiers-no-spaces"`
        );
      },
      errors: 1,
    },
    {
      code: `export {e,b,a as c}; var e, b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export {a as c,b,e}; var e, b, a;`
        );
      },
      errors: 1,
    },

    // Space before specifiers.
    {
      code: `import { b,a} from "specifiers-no-space-before"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,b} from "specifiers-no-space-before"`
        );
      },
      errors: 1,
    },
    {
      code: `export { b,a} from "specifiers-no-space-before"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b} from "specifiers-no-space-before"`
        );
      },
      errors: 1,
    },
    {
      code: `export { b,a}; var b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`export { a,b}; var b, a;`);
      },
      errors: 1,
    },

    // Space after specifiers.
    {
      code: `import {b,a } from "specifiers-no-space-after"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import {a,b } from "specifiers-no-space-after"`
        );
      },
      errors: 1,
    },
    {
      code: `export {b,a } from "specifiers-no-space-after"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export {a,b } from "specifiers-no-space-after"`
        );
      },
      errors: 1,
    },
    {
      code: `export {b,a }; var b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`export {a,b }; var b, a;`);
      },
      errors: 1,
    },

    // Space after specifiers.
    {
      code: `import {b,a, } from "specifiers-no-space-after-trailing"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import {a,b, } from "specifiers-no-space-after-trailing"`
        );
      },
      errors: 1,
    },
    {
      code: `export {b,a, } from "specifiers-no-space-after-trailing"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export {a,b, } from "specifiers-no-space-after-trailing"`
        );
      },
      errors: 1,
    },
    {
      code: `export {b,a, }; var b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`export {a,b, }; var b, a;`);
      },
      errors: 1,
    },

    // Sorting specifiers with comments.
    {
      code: input`
          |import {
          |  // c
          |  c,
          |  b, // b
          |  a
          |  // last
          |} from "specifiers-comments"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          |  b, // b
          |  // c
          |  c
          |  // last
          |} from "specifiers-comments"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  // c
          |  c,
          |  b, // b
          |  a
          |  // last
          |} from "specifiers-comments"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  b, // b
          |  // c
          |  c
          |  // last
          |} from "specifiers-comments"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  // c
          |  c,
          |  b, // b
          |  a
          |  // last
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  b, // b
          |  // c
          |  c
          |  // last
          |}
        `);
      },
      errors: 1,
    },

    // Comment after last specifier should stay last.
    {
      code: input`
          |import {
          |  // c
          |  c,b, // b
          |  a
          |  // last
          |} from "specifiers-comments-last"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          |b, // b
          |  // c
          |  c
          |  // last
          |} from "specifiers-comments-last"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  // c
          |  c,b, // b
          |  a
          |  // last
          |} from "specifiers-comments-last"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |b, // b
          |  // c
          |  c
          |  // last
          |} from "specifiers-comments-last"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  // c
          |  c,b, // b
          |  a
          |  // last
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |b, // b
          |  // c
          |  c
          |  // last
          |}
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with comment between.
    {
      code: `import { b /* b */, a } from "specifiers-comment-between"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,b /* b */ } from "specifiers-comment-between"`
        );
      },
      errors: 1,
    },
    {
      code: `export { b /* b */, a } from "specifiers-comment-between"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b /* b */ } from "specifiers-comment-between"`
        );
      },
      errors: 1,
    },
    {
      code: `export { b /* b */, a }; var b, a;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b /* b */ }; var b, a;`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with trailing comma and trailing comments.
    {
      code: input`
          |import {
          |  c,
          |  a,
          |  // x
          |  // y
          |} from "specifiers-trailing"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          |  c,
          |  // x
          |  // y
          |} from "specifiers-trailing"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  c,
          |  a,
          |  // x
          |  // y
          |} from "specifiers-trailing"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  c,
          |  // x
          |  // y
          |} from "specifiers-trailing"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  c,
          |  a,
          |  // x
          |  // y
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  c,
          |  // x
          |  // y
          |}
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with multiline comments.
    {
      code: input`
          |import {
          |  /*c1*/ c, /*c2*/ /*a1
          |  */a, /*a2*/ /*
          |  after */
          |  // x
          |  // y
          |} from "specifiers-multiline-comments"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |/*a1
          |  */a, /*a2*/ 
          |  /*c1*/ c, /*c2*/ /*
          |  after */
          |  // x
          |  // y
          |} from "specifiers-multiline-comments"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  /*c1*/ c, /*c2*/ /*a1
          |  */a, /*a2*/ /*
          |  after */
          |  // x
          |  // y
          |} from "specifiers-multiline-comments"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |/*a1
          |  */a, /*a2*/ 
          |  /*c1*/ c, /*c2*/ /*
          |  after */
          |  // x
          |  // y
          |} from "specifiers-multiline-comments"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  /*c1*/ c, /*c2*/ /*a1
          |  */a, /*a2*/ /*
          |  after */
          |  // x
          |  // y
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |/*a1
          |  */a, /*a2*/ 
          |  /*c1*/ c, /*c2*/ /*
          |  after */
          |  // x
          |  // y
          |}
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with multiline end comment.
    {
      code: input`
          |import {
          |  b,
          |  a /*
          |  after */
          |} from "specifiers-multiline-end-comment"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,   b/*
          |  after */
          |} from "specifiers-multiline-end-comment"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*
          |  after */
          |} from "specifiers-multiline-end-comment"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,   b/*
          |  after */
          |} from "specifiers-multiline-end-comment"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*
          |  after */
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,   b/*
          |  after */
          |}
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with multiline end comment after newline.
    {
      code: input`
          |import {
          |  b,
          |  a /*a*/
          |  /*
          |  after */
          |} from "specifiers-multiline-end-comment-after-newline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a, /*a*/
          |  b  /*
          |  after */
          |} from "specifiers-multiline-end-comment-after-newline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*a*/
          |  /*
          |  after */
          |} from "specifiers-multiline-end-comment-after-newline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a, /*a*/
          |  b  /*
          |  after */
          |} from "specifiers-multiline-end-comment-after-newline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*a*/
          |  /*
          |  after */
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a, /*a*/
          |  b  /*
          |  after */
          |}
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with multiline end comment and no newline.
    {
      code: input`
          |import {
          |  b,
          |  a /*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,   b/*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,   b/*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b,
          |  a /*
          |  after */ }
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,   b/*
          |  after */ }
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with lots of comments.
    {
      code: `/*1*//*2*/import/*3*/def,/*4*/{/*{*/e/*e1*/,/*e2*//*e3*/b/*b1*/,/*b2*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `/*1*//*2*/import/*3*/def,/*4*/{/*{*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/b/*b1*/,/*b2*/e/*e1*/,/*e2*//*e3*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`
        );
      },
      errors: 1,
    },
    {
      code: `/*1*//*2*/export/*3*//*4*/{/*{*/e/*e1*/,/*e2*//*e3*/b/*b1*/,/*b2*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `/*1*//*2*/export/*3*//*4*/{/*{*/b/*b1*/,/*b2*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/e/*e1*/,/*e2*//*e3*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with lots of comments, multiline.
    {
      code: input`
          |import { // start
          |  /* c1 */ c /* c2 */, // c3
          |  // b1
          |
          |  b as /* b2 */ renamed
          |  , /* b3 */ /* a1
          |  */ a /* not-a
          |  */ // comment at end
          |} from "specifiers-lots-of-comments-multiline";
          |import {
          |  e,
          |  d, /* d */ /* not-d
          |  */ // comment at end after trailing comma
          |} from "specifiers-lots-of-comments-multiline-2";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { // start
          |/* a1
          |  */ a, 
          |  // b1
          |  b as /* b2 */ renamed
          |  , /* b3 */ 
          |  /* c1 */ c /* c2 */// c3
          |/* not-a
          |  */ // comment at end
          |} from "specifiers-lots-of-comments-multiline";
          |import {
          |  d, /* d */   e,
          |/* not-d
          |  */ // comment at end after trailing comma
          |} from "specifiers-lots-of-comments-multiline-2";
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export { // start
          |  /* c1 */ c /* c2 */, // c3
          |  // b1
          |
          |  b as /* b2 */ renamed
          |  , /* b3 */ /* a1
          |  */ a /* not-a
          |  */ // comment at end
          |} from "specifiers-lots-of-comments-multiline";
          |export {
          |  e,
          |  d, /* d */ /* not-d
          |  */ // comment at end after trailing comma
          |} from "specifiers-lots-of-comments-multiline-2";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { // start
          |/* a1
          |  */ a, 
          |  /* c1 */ c /* c2 */, // c3
          |  // b1
          |  b as /* b2 */ renamed
          |  /* b3 */ /* not-a
          |  */ // comment at end
          |} from "specifiers-lots-of-comments-multiline";
          |export {
          |  d, /* d */   e,
          |/* not-d
          |  */ // comment at end after trailing comma
          |} from "specifiers-lots-of-comments-multiline-2";
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export { // start
          |  /* c1 */ c /* c2 */, // c3
          |  // b1
          |
          |  b as /* b2 */ renamed
          |  , /* b3 */ /* a1
          |  */ a /* not-a
          |  */ // comment at end
          |};
          |export {
          |  e,
          |  d, /* d */ /* not-d
          |  */ // comment at end after trailing comma
          |};
          |var c, b, a, e, d;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { // start
          |/* a1
          |  */ a, 
          |  // b1
          |  b as /* b2 */ renamed
          |  , /* b3 */ 
          |  /* c1 */ c /* c2 */// c3
          |/* not-a
          |  */ // comment at end
          |};
          |export {
          |  d, /* d */   e,
          |/* not-d
          |  */ // comment at end after trailing comma
          |};
          |var c, b, a, e, d;
        `);
      },
      errors: 1,
    },

    // No empty line after last specifier due to newline before comma.
    {
      code: input`
          |import {
          |  b/*b*/
          |  ,
          |  a
          |} from "specifiers-blank";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          |  b/*b*/
          |  } from "specifiers-blank";
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b/*b*/
          |  ,
          |  a
          |} from "specifiers-blank";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  b/*b*/
          |  } from "specifiers-blank";
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |  b/*b*/
          |  ,
          |  a
          |};
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          |  b/*b*/
          |  };
        `);
      },
      errors: 1,
    },

    // Sorting both inline and multiline specifiers.
    {
      code: input`
          |import {z, y,
          |  x,
          |
          |w,
          |    v
          |  as /*v*/
          |
          |    u , t /*t*/, // t
          |    s
          |} from "specifiers-inline-multiline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {    s,
          |t /*t*/, // t
          |    v
          |  as /*v*/
          |    u , w,
          |  x,
          |y,
          |z} from "specifiers-inline-multiline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {z, y,
          |  x,
          |
          |w,
          |    v
          |  as /*v*/
          |
          |    u , t /*t*/, // t
          |    s
          |} from "specifiers-inline-multiline"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {    s,
          |t /*t*/, // t
          |    v
          |  as /*v*/
          |    u , w,
          |  x,
          |y,
          |z} from "specifiers-inline-multiline"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {z, y,
          |  x,
          |
          |w,
          |    v
          |  as /*v*/
          |
          |    u , t /*t*/, // t
          |    s
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {    s,
          |t /*t*/, // t
          |    v
          |  as /*v*/
          |    u , w,
          |  x,
          |y,
          |z}
        `);
      },
      errors: 1,
    },

    // Indent: 0.
    {
      code: input`
          |import {
          |b,
          |a,
          |} from "specifiers-indent-0"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |a,
          |b,
          |} from "specifiers-indent-0"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |b,
          |a,
          |} from "specifiers-indent-0"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |a,
          |b,
          |} from "specifiers-indent-0"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |b,
          |a,
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |a,
          |b,
          |}
        `);
      },
      errors: 1,
    },

    // Indent: 4.
    {
      code: input`
          |import {
          |    b,
          |    a,
          |} from "specifiers-indent-4"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |    a,
          |    b,
          |} from "specifiers-indent-4"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |    b,
          |    a,
          |} from "specifiers-indent-4"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |    a,
          |    b,
          |} from "specifiers-indent-4"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |    b,
          |    a,
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |    a,
          |    b,
          |}
        `);
      },
      errors: 1,
    },

    // Indent: tab.
    {
      code: input`
          |import {
          |\tb,
          |\ta,
          |} from "specifiers-indent-tab"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |→a,
          |→b,
          |} from "specifiers-indent-tab"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |\tb,
          |\ta,
          |} from "specifiers-indent-tab"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |→a,
          |→b,
          |} from "specifiers-indent-tab"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |\tb,
          |\ta,
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |→a,
          |→b,
          |}
        `);
      },
      errors: 1,
    },

    // Indent: mixed.
    {
      code: input`
          |import {
          | //
          |\tb,
          |  a,
          |
          |    c,
          |} from "specifiers-indent-mixed"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          | //
          |→b,
          |    c,
          |} from "specifiers-indent-mixed"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          | //
          |\tb,
          |  a,
          |
          |    c,
          |} from "specifiers-indent-mixed"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          | //
          |→b,
          |    c,
          |} from "specifiers-indent-mixed"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          | //
          |\tb,
          |  a,
          |
          |    c,
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  a,
          | //
          |→b,
          |    c,
          |}
        `);
      },
      errors: 1,
    },

    // Several chunks.
    {
      code: input`
          |require("c");
          |
          |export {x3} from "a"
          |import x1 from "b"
          |import x2 from "a"
          |export {x4} from "c"
          |require("c");
          |
          |import x3 from "b"
          |export default 5
          |export const answer = 42
          |import x4 from "a" // x4
          |
          |// c1
          |require("c");
          |import x5 from "b"
          |// x6-1
          |import x6 from "a" /* after
          |*/
          |
          |require("c"); import x7 from "b"; import x8 from "a"; export {x9}; require("c")
          |var x8
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |require("c");
          |
          |import x2 from "a"
          |import x1 from "b"
          |
          |export {x3} from "a"
          |export {x4} from "c"
          |require("c");
          |
          |import x4 from "a" // x4
          |import x3 from "b"
          |
          |export default 5
          |export const answer = 42
          |
          |// c1
          |require("c");
          |// x6-1
          |import x6 from "a" 
          |import x5 from "b"/* after
          |*/
          |
          |require("c"); import x8 from "a"; 
          |import x7 from "b";
          |export {x8}; require("c")
          |var x8
        `);
      },
      errors: 4,
    },

    // Original order is preserved for duplicate imports/exports.
    {
      code: input`
          |import b from "b"
          |import a1 from "a"
          |import {a2} from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a1 from "a"
          |import {a2} from "a"
          |import b from "b"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {b} from "b"
          |export {a1} from "a"
          |export {a2} from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a1} from "a"
          |export {a2} from "a"
          |export {b} from "b"
        `);
      },
      errors: 1,
    },

    // Original order is preserved for duplicate imports/exports (reversed example).
    {
      code: input`
          |import b from "b"
          |import {a2} from "a"
          |import a1 from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {a2} from "a"
          |import a1 from "a"
          |import b from "b"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {b} from "b"
          |export {a2} from "a"
          |export {a1} from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a2} from "a"
          |export {a1} from "a"
          |export {b} from "b"
        `);
      },
      errors: 1,
    },

    // Special characters sorting order.
    {
      code: input`
          |import {} from "";
          |import {} from ".";
          |import {} from ".//";
          |import {} from "./";
          |import {} from "./B"; // B1
          |import {} from "./b";
          |import {} from "./B"; // B2
          |import {} from "./A";
          |import {} from "./a";
          |import {} from "./ä";
          |import {} from "./ä"; // “a” followed by “\u0308̈” (COMBINING DIAERESIS).
          |import {} from "..";
          |import {} from "../";
          |import {} from "../a";
          |import {} from "../a/..";
          |import {} from "../a/../";
          |import {} from "../a/...";
          |import {} from "../a/../b";
          |import {} from "../../";
          |import {} from "../..";
          |import {} from "../../a";
          |import {} from "...";
          |import {} from ".../";
          |import {} from ".a";
          |import {} from "/";
          |import {} from "/a";
          |import {} from "/a/b";
          |import {} from "https://example.com/script.js";
          |import {} from "http://example.com/script.js";
          |import {} from "react";
          |import {} from "async";
          |import {} from "./a/-";
          |import {} from "./a/.";
          |import {} from "./a/0";
          |import {} from "@/components/error.vue"
          |import {} from "@/components/Alert"
          |import {} from "~/test"
          |import {} from "#/test"
          |import {} from "fs";
          |import {} from "fs/something";
          |import {} from "Fs";
          |import {} from "lodash/fp";
          |import {} from "@storybook/react";
          |import {} from "@storybook/react/something";
          |import {} from "1";
          |import {} from "1*";
          |import {} from "a*";
          |import img2 from "./img2";
          |import img10 from "./img10";
          |import img1 from "./img1";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {} from "@storybook/react";
          |import {} from "@storybook/react/something";
          |import {} from "1";
          |import {} from "1*";
          |import {} from "a*";
          |import {} from "async";
          |import {} from "Fs";
          |import {} from "fs";
          |import {} from "fs/something";
          |import {} from "http://example.com/script.js";
          |import {} from "https://example.com/script.js";
          |import {} from "lodash/fp";
          |import {} from "react";
          |
          |import {} from "@/components/Alert"
          |import {} from "@/components/error.vue"
          |import {} from "/";
          |import {} from "/a";
          |import {} from "/a/b";
          |import {} from "#/test"
          |import {} from "~/test"
          |
          |import {} from "...";
          |import {} from ".../";
          |import {} from "..";
          |import {} from "../";
          |import {} from "../..";
          |import {} from "../../";
          |import {} from "../../a";
          |import {} from "../a";
          |import {} from "../a/..";
          |import {} from "../a/...";
          |import {} from "../a/../";
          |import {} from "../a/../b";
          |import {} from ".";
          |import {} from "./";
          |import {} from ".//";
          |import {} from "./A";
          |import {} from "./a";
          |import {} from "./ä"; // “a” followed by “̈̈” (COMBINING DIAERESIS).
          |import {} from "./ä";
          |import {} from "./a/-";
          |import {} from "./a/.";
          |import {} from "./a/0";
          |import {} from "./B"; // B1
          |import {} from "./B"; // B2
          |import {} from "./b";
          |import img1 from "./img1";
          |import img2 from "./img2";
          |import img10 from "./img10";
          |import {} from ".a";
          |
          |import {} from "";
        `);
      },
      errors: 1,
    },

    // Comments.
    {
      code: input`
          |// before
          |
          |/* also
          |before */ /* b */ import b from "b" // b
          |// above d
          |  import d /*d1*/ from   "d" ; /* d2 */ /* before
          |  c0 */ // before c1
          |  /* c0
          |*/ /*c1*/ /*c2*/import c from 'c' ; /*c3*/ import a from "a" /*a*/ /*
          |   x1 */ /* x2 */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |
          |/* also
          |before */ import a from "a" /*a*/ 
          |/* b */ import b from "b" // b
          |/* before
          |  c0 */ // before c1
          |  /* c0
          |*/ /*c1*/ /*c2*/import c from 'c' ; /*c3*/ 
          |// above d
          |  import d /*d1*/ from   "d" ; /* d2 */ /*
          |   x1 */ /* x2 */
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |// before
          |
          |/* also
          |before */ /* b */ export {b} from "b" // b
          |// above d
          |  export {d} /*d1*/ from   "d" ; /* d2 */ /* before
          |  c0 */ // before c1
          |  /* c0
          |*/ /*c1*/ /*c2*/export {c} from 'c' ; /*c3*/ export {a} from "a" /*a*/ /*
          |   x1 */ /* x2 */
          |var d
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |
          |/* also
          |before */ export {a} from "a" /*a*/ 
          |/* b */ export {b} from "b" // b
          |/* before
          |  c0 */ // before c1
          |  /* c0
          |*/ /*c1*/ /*c2*/export {c} from 'c' ; /*c3*/ 
          |// above d
          |  export {d} /*d1*/ from   "d" ; /* d2 */ /*
          |   x1 */ /* x2 */
          |var d
        `);
      },
      errors: 1,
    },

    // Line comment and code after.
    {
      code: input`
          |import b from "b"; // b
          |import a from "a"; code();
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; 
          |import b from "b"; // b
          |code();
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {b} from "b"; // b
          |export {a} from "a"; code();
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from "a"; 
          |export {b} from "b"; // b
          |code();
        `);
      },
      errors: 1,
    },

    // Line comment and multiline block comment after.
    {
      code: input`
          |import b from "b"; // b
          |import a from "a"; /*
          |after */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; 
          |import b from "b"; // b
          |/*
          |after */
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {b} from "b"; // b
          |export {a} from "a"; /*
          |after */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from "a"; 
          |export {b} from "b"; // b
          |/*
          |after */
        `);
      },
      errors: 1,
    },

    // Line comment but _singleline_ block comment after.
    {
      code: input`
          |import b from "b"; // b
          |import a from "a"; /* a */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; /* a */
          |import b from "b"; // b
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {b} from "b"; // b
          |export {a} from "a"; /* a */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from "a"; /* a */
          |export {b} from "b"; // b
        `);
      },
      errors: 1,
    },

    // Test messageId, lines and columns.
    {
      code: input`
          |// before
          |/* also
          |before */ import b from "b";
          |import a from "a"; /*a*/ /* comment
          |after */ // after
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |/* also
          |before */ import a from "a"; /*a*/ 
          |import b from "b";/* comment
          |after */ // after
        `);
      },
      errors: [
        {
          messageId: "imports",
          line: 3,
          column: 11,
          endLine: 4,
          endColumn: 26,
        },
      ],
    },
    {
      code: input`
          |// before
          |/* also
          |before */ export {b} from "b";
          |export {a} from "a"; /*a*/ /* comment
          |after */ // after
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |/* also
          |before */ export {a} from "a"; /*a*/ 
          |export {b} from "b";/* comment
          |after */ // after
        `);
      },
      errors: [
        {
          messageId: "exports",
          line: 3,
          column: 11,
          endLine: 4,
          endColumn: 26,
        },
      ],
    },
    {
      code: input`
          |// before
          |/* also
          |before */  {b} from "b";
          |import a from "a"; /*a*/ /* comment
          |after */ // after
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |/* also
          |before */ import a from "a"; /*a*/ 
          |
          |export {b} from "b";/* comment
          |after */ // after
        `);
      },
      errors: [
        {
          messageId: "both",
          line: 3,
          column: 11,
          endLine: 4,
          endColumn: 26,
        },
      ],
    },

    // Collapse blank lines between comments.
    {
      code: input`
          |import c from "c"
          |// b1
          |
          |// b2
          |import b from "b"
          |// a
          |
          |import a from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// a
          |import a from "a"
          |// b1
          |// b2
          |import b from "b"
          |import c from "c"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {c} from "c"
          |// b1
          |
          |// b2
          |export {b} from "b"
          |// a
          |
          |export {a} from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// a
          |export {a} from "a"
          |// b1
          |// b2
          |export {b} from "b"
          |export {c} from "c"
        `);
      },
      errors: 1,
    },

    // Collapse blank lines between comments – CR.
    {
      code: input`
          |import c from "c"\r
          |// b1\r
          |\r
          |// b2\r
          |import b from "b"\r
          |// a\r
          |\r
          |import a from "a"\r
          |after();\r
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// a<CR>
          |import a from "a"<CR>
          |// b1<CR>
          |// b2<CR>
          |import b from "b"<CR>
          |import c from "c"<CR>
          |after();<CR>
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {c} from "c"\r
          |// b1\r
          |\r
          |// b2\r
          |export {b} from "b"\r
          |// a\r
          |\r
          |export {a} from "a"\r
          |after();\r
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// a<CR>
          |export {a} from "a"<CR>
          |// b1<CR>
          |// b2<CR>
          |export {b} from "b"<CR>
          |export {c} from "c"<CR>
          |after();<CR>
        `);
      },
      errors: 1,
    },

    // Collapse blank lines inside import/export statements.
    {
      code: input`
          |import
          |
          |// import
          |
          |def /* default */
          |
          |,
          |
          |// default
          |
          | {
          |
          |  // c
          |
          |  c /*c*/,
          |
          |  /* b
          |   */
          |
          |  b // b
          |  ,
          |
          |  // a1
          |
          |  // a2
          |
          |  a
          |
          |  // a3
          |
          |  as
          |
          |  // a4
          |
          |  d
          |
          |  // a5
          |
          |  , // a6
          |
          |  // last
          |
          |}
          |
          |// from1
          |
          |from
          |
          |// from2
          |
          |"c"
          |
          |// final
          |
          |;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import
          |// import
          |def /* default */
          |,
          |// default
          | {
          |  // a1
          |  // a2
          |  a
          |  // a3
          |  as
          |  // a4
          |  d
          |  // a5
          |  , // a6
          |  /* b
          |   */
          |  b // b
          |  ,
          |  // c
          |  c /*c*/,
          |  // last
          |}
          |// from1
          |from
          |// from2
          |"c"
          |// final
          |;
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export
          |
          |// export
          |
          |/* default */
          |
          |
          |
          |// default
          |
          | {
          |
          |  // c
          |
          |  c /*c*/,
          |
          |  /* b
          |   */
          |
          |  b // b
          |  ,
          |
          |  // a1
          |
          |  // a2
          |
          |  a
          |
          |  // a3
          |
          |  as
          |
          |  // a4
          |
          |  d
          |
          |  // a5
          |
          |  , // a6
          |
          |  // last
          |
          |}
          |
          |// from1
          |
          |from
          |
          |// from2
          |
          |"c"
          |
          |// final
          |
          |;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export
          |// export
          |/* default */
          |// default
          | {
          |  /* b
          |   */
          |  b // b
          |  ,
          |  // c
          |  c /*c*/,
          |  // a1
          |  // a2
          |  a
          |  // a3
          |  as
          |  // a4
          |  d
          |  // a5
          |  , // a6
          |  // last
          |}
          |// from1
          |from
          |// from2
          |"c"
          |// final
          |;
        `);
      },
      errors: 1,
    },

    // Collapse blank lines inside empty specifier list.
    {
      code: input`
          |import {
          |
          |    } from "specifiers-empty"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |    } from "specifiers-empty"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |
          |    } from "specifiers-empty"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |    } from "specifiers-empty"
        `);
      },
      errors: 1,
    },

    // Do not collapse empty lines inside export code.
    {
      code: input`
          |export const options = {
          |
          |    a: 1,
          |
          |    b: 2
          |    }"specifiers-empty"
          |export {a} from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from "a"
          |
          |export const options = {
          |
          |    a: 1,
          |
          |    b: 2
          |    }"specifiers-empty"
        `);
      },
      errors: 1,
    },

    // Single-line comment at the end of the last specifier should not comment
    // out the `from` part.
    {
      code: input`
          |import {
          |
          |  b // b
          |  ,a} from "specifiers-line-comment"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |a,  b // b
          |  } from "specifiers-line-comment"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {
          |
          |  b // b
          |  ,a} from "specifiers-line-comment"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |a,  b // b
          |  } from "specifiers-line-comment"
        `);
      },
      errors: 1,
    },

    // Preserve indentation (for `<script>` tags).
    {
      code: input`
          |  import e from "e"
          |  // b
          |  import {
          |    b4, b3,
          |    b2
          |  } from "b";
          |  /* a */ import a from "a"; import c from "c"
          |  
          |    // d
          |    import d from "d"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |  /* a */ import a from "a"; 
          |  // b
          |  import {
          |    b2,
          |b3,
          |    b4  } from "b";
          |import c from "c"
          |    // d
          |    import d from "d"
          |  import e from "e"
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |  export {e} from "e"
          |  // b
          |  export {
          |    b4, b3,
          |    b2
          |  } from "b";
          |  /* a */ export {a} from "a"; export {c} from "c"
          |  
          |    // d
          |    export {d} from "d"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |  /* a */ export {a} from "a"; 
          |  // b
          |  export {
          |    b2,
          |b3,
          |    b4  } from "b";
          |export {c} from "c"
          |    // d
          |    export {d} from "d"
          |  export {e} from "e"
        `);
      },
      errors: 1,
    },

    // Preserve indentation (for `<script>` tags) – CR.
    {
      code: input`
          |      \r
          |  import e from "e"\r
          |  // b\r
          |  import {\r
          |    b4, b3,\r
          |    b2\r
          |  } from "b";\r
          |  /* a */ import a from "a"; import c from "c"\r
          | \r
          |    // d\r
          |    import d from "d"\r
          |
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |      <CR>
          |  /* a */ import a from "a"; <CR>
          |  // b<CR>
          |  import {<CR>
          |    b2,<CR>
          |b3,<CR>
          |    b4  } from "b";<CR>
          |import c from "c"<CR>
          |    // d<CR>
          |    import d from "d"<CR>
          |  import e from "e"<CR>
          |
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |      \r
          |  export {e} from "e"\r
          |  // b\r
          |  export {\r
          |    b4, b3,\r
          |    b2\r
          |  } from "b";\r
          |  /* a */ export {a} from "a"; export {c} from "c"\r
          | \r
          |    // d\r
          |    export {d} from "d"\r
          |
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |      <CR>
          |  /* a */ export {a} from "a"; <CR>
          |  // b<CR>
          |  export {<CR>
          |    b2,<CR>
          |b3,<CR>
          |    b4  } from "b";<CR>
          |export {c} from "c"<CR>
          |    // d<CR>
          |    export {d} from "d"<CR>
          |  export {e} from "e"<CR>
          |
        `);
      },
      errors: 1,
    },

    // Trailing spaces.
    {
      code: input`
          |import c from "c";  /* comment */  
          |import b from "b";    
          |import d from "d";  /* multiline
          |comment */  
          |import a from "a"    
          |import e from "e"; /* multiline
          |comment 2 */ import f from "f";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |/* multiline
          |comment */  
          |import a from "a"    
          |import b from "b";    
          |import c from "c";  /* comment */  
          |import d from "d";  
          |import e from "e"; 
          |/* multiline
          |comment 2 */ import f from "f";
        `);
      },
      errors: 1,
    },
    {
      code: input`
          |export {c} from "c";  /* comment */  
          |export {b} from "b";    
          |export {d} from "d";  /* multiline
          |comment */  
          |export {a} from "a"    
          |export {e}; /* multiline
          |comment 2 */ export {f} from "f";
          |var e
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |/* multiline
          |comment */  
          |export {a} from "a"    
          |export {b} from "b";    
          |export {c} from "c";  /* comment */  
          |export {d} from "d";  
          |/* multiline
          |comment 2 */ export {f} from "f";
          |
          |export {e}; 
          |var e
        `);
      },
      errors: 1,
    },

    // Sort like IntelliJ/WebStorm (case insensitive on `from`).
    // https://github.com/lydell/eslint-plugin-simple-import-sort/issues/7#issuecomment-500593886
    {
      code: input`
          |import FloatingActionButton from 'src/components/FloatingActionButton'
          |import { Select, linkButton, buttonPrimary, spinnerOverlay } from 'src/components/common'
          |import { icon, spinner } from 'src/components/icons'
          |import { notify } from 'src/components/Notifications'
          |import { IGVBrowser } from 'src/components/IGVBrowser'
          |import { IGVFileSelector } from 'src/components/IGVFileSelector'
          |import { DelayedSearchInput, TextInput } from 'src/components/input'
          |import DataTable from 'src/components/DataTable'
          |import { FlexTable, SimpleTable, HeaderCell, TextCell } from 'src/components/table'
          |import Modal from 'src/components/Modal'
          |import ExportDataModal from 'src/components/ExportDataModal'
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { buttonPrimary, linkButton, Select, spinnerOverlay } from 'src/components/common'
          |import DataTable from 'src/components/DataTable'
          |import ExportDataModal from 'src/components/ExportDataModal'
          |import FloatingActionButton from 'src/components/FloatingActionButton'
          |import { icon, spinner } from 'src/components/icons'
          |import { IGVBrowser } from 'src/components/IGVBrowser'
          |import { IGVFileSelector } from 'src/components/IGVFileSelector'
          |import { DelayedSearchInput, TextInput } from 'src/components/input'
          |import Modal from 'src/components/Modal'
          |import { notify } from 'src/components/Notifications'
          |import { FlexTable, HeaderCell, SimpleTable, TextCell } from 'src/components/table'
        `);
      },
      errors: 1,
    },

    // https://github.com/gothinkster/react-redux-realworld-example-app/blob/b5557d1fd40afebe023e3102ad6ef50475146506/src/components/App.js#L1-L16
    {
      code: input`
          |import agent from '../agent';
          |import Header from './Header';
          |import React from 'react';
          |import { connect } from 'react-redux';
          |import { APP_LOAD, REDIRECT } from '../constants/actionTypes';
          |import { Route, Switch } from 'react-router-dom';
          |import Article from '../components/Article';
          |import Editor from '../components/Editor';
          |import Home from '../components/Home';
          |import Login from '../components/Login';
          |import Profile from '../components/Profile';
          |import ProfileFavorites from '../components/ProfileFavorites';
          |import Register from '../components/Register';
          |import Settings from '../components/Settings';
          |import { store } from '../store';
          |import { push } from 'react-router-redux';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import React from 'react';
          |import { connect } from 'react-redux';
          |import { Route, Switch } from 'react-router-dom';
          |import { push } from 'react-router-redux';
          |
          |import agent from '../agent';
          |import Article from '../components/Article';
          |import Editor from '../components/Editor';
          |import Home from '../components/Home';
          |import Login from '../components/Login';
          |import Profile from '../components/Profile';
          |import ProfileFavorites from '../components/ProfileFavorites';
          |import Register from '../components/Register';
          |import Settings from '../components/Settings';
          |import { APP_LOAD, REDIRECT } from '../constants/actionTypes';
          |import { store } from '../store';
          |import Header from './Header';
        `);
      },
      errors: 1,
    },

    // https://github.com/gothinkster/react-redux-realworld-example-app/blob/b5557d1fd40afebe023e3102ad6ef50475146506/src/components/Editor.js#L1-L12
    {
      code: input`
          |import ListErrors from './ListErrors';
          |import React from 'react';
          |import agent from '../agent';
          |import { connect } from 'react-redux';
          |import {
          |  ADD_TAG,
          |  EDITOR_PAGE_LOADED,
          |  REMOVE_TAG,
          |  ARTICLE_SUBMITTED,
          |  EDITOR_PAGE_UNLOADED,
          |  UPDATE_FIELD_EDITOR
          |} from '../constants/actionTypes';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import React from 'react';
          |import { connect } from 'react-redux';
          |
          |import agent from '../agent';
          |import {
          |  ADD_TAG,
          |  ARTICLE_SUBMITTED,
          |  EDITOR_PAGE_LOADED,
          |  EDITOR_PAGE_UNLOADED,
          |  REMOVE_TAG,
          |  UPDATE_FIELD_EDITOR
          |} from '../constants/actionTypes';
          |import ListErrors from './ListErrors';
        `);
      },
      errors: 1,
    },

    // https://github.com/facebook/react/blob/4c7036e807fa18a3e21a5182983c7c0f05c5936e/packages/react-dom/src/client/ReactDOM.js#L193-L217
    {
      code: input`
          |export {
          |  createPortal,
          |  batchedUpdates as unstable_batchedUpdates,
          |  flushSync,
          |  Internals as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
          |  ReactVersion as version,
          |  // Disabled behind disableLegacyReactDOMAPIs
          |  findDOMNode,
          |  hydrate,
          |  render,
          |  unmountComponentAtNode,
          |  // exposeConcurrentModeAPIs
          |  createRoot,
          |  createBlockingRoot,
          |  flushControlled as unstable_flushControlled,
          |  scheduleHydration as unstable_scheduleHydration,
          |  // Disabled behind disableUnstableRenderSubtreeIntoContainer
          |  renderSubtreeIntoContainer as unstable_renderSubtreeIntoContainer,
          |  // Disabled behind disableUnstableCreatePortal
          |  // Temporary alias since we already shipped React 16 RC with it.
          |  // TODO: remove in React 18.
          |  unstable_createPortal,
          |  // enableCreateEventHandleAPI
          |  createEventHandle as unstable_createEventHandle,
          |};
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {
          |  batchedUpdates as unstable_batchedUpdates,
          |  createBlockingRoot,
          |  // enableCreateEventHandleAPI
          |  createEventHandle as unstable_createEventHandle,
          |  createPortal,
          |  // exposeConcurrentModeAPIs
          |  createRoot,
          |  // Disabled behind disableLegacyReactDOMAPIs
          |  findDOMNode,
          |  flushControlled as unstable_flushControlled,
          |  flushSync,
          |  hydrate,
          |  Internals as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
          |  ReactVersion as version,
          |  render,
          |  // Disabled behind disableUnstableRenderSubtreeIntoContainer
          |  renderSubtreeIntoContainer as unstable_renderSubtreeIntoContainer,
          |  scheduleHydration as unstable_scheduleHydration,
          |  unmountComponentAtNode,
          |  // Disabled behind disableUnstableCreatePortal
          |  // Temporary alias since we already shipped React 16 RC with it.
          |  // TODO: remove in React 17.
          |  unstable_createPortal,
          |};
        `);
      },
      errors: 1,
    },

    // https://github.com/apollographql/apollo-client/blob/39942881567ff9825a0f17bbf114ec441590f8bb/src/core/index.ts#L1-L98
    {
      code: input`
          |export {
          |/* Core */
          |
          |export {
          |  ApolloClient,
          |  ApolloClientOptions,
          |  DefaultOptions
          |} from '../ApolloClient';
          |export {
          |  ObservableQuery,
          |  FetchMoreOptions,
          |  UpdateQueryOptions,
          |  ApolloCurrentQueryResult,
          |} from '../core/ObservableQuery';
          |export {
          |  QueryBaseOptions,
          |  QueryOptions,
          |  WatchQueryOptions,
          |  MutationOptions,
          |  SubscriptionOptions,
          |  FetchPolicy,
          |  WatchQueryFetchPolicy,
          |  ErrorPolicy,
          |  FetchMoreQueryOptions,
          |  SubscribeToMoreOptions,
          |  MutationUpdaterFn,
          |} from '../core/watchQueryOptions';
          |export { NetworkStatus } from '../core/networkStatus';
          |export * from '../core/types';
          |export {
          |  Resolver,
          |  FragmentMatcher as LocalStateFragmentMatcher,
          |} from '../core/LocalState';
          |export { isApolloError, ApolloError } from '../errors/ApolloError';
          |
          |/* Cache */
          |
          |export * from '../cache';
          |
          |/* Link */
          |
          |export { empty } from '../link/core/empty';
          |export { from } from '../link/core/from';
          |export { split } from '../link/core/split';
          |export { concat } from '../link/core/concat';
          |export { execute } from '../link/core/execute';
          |export { ApolloLink } from '../link/core/ApolloLink';
          |export * from '../link/core/types';
          |export {
          |  parseAndCheckHttpResponse,
          |  ServerParseError
          |} from '../link/http/parseAndCheckHttpResponse';
          |export {
          |  serializeFetchParameter,
          |  ClientParseError
          |} from '../link/http/serializeFetchParameter';
          |export {
          |  HttpOptions,
          |  fallbackHttpConfig,
          |  selectHttpOptionsAndBody,
          |  UriFunction
          |} from '../link/http/selectHttpOptionsAndBody';
          |export { checkFetcher } from '../link/http/checkFetcher';
          |export { createSignalIfSupported } from '../link/http/createSignalIfSupported';
          |export { selectURI } from '../link/http/selectURI';
          |export { createHttpLink } from '../link/http/createHttpLink';
          |export { HttpLink } from '../link/http/HttpLink';
          |export { fromError } from '../link/utils/fromError';
          |export { toPromise } from '../link/utils/toPromise';
          |export { fromPromise } from '../link/utils/fromPromise';
          |export { ServerError, throwServerError } from '../link/utils/throwServerError';
          |export {
          |  Observable,
          |  Observer,
          |  ObservableSubscription
          |} from '../utilities/observables/Observable';
          |
          |/* Supporting */
          |
          |// Note that importing \`gql\` by itself, then destructuring
          |// additional properties separately before exporting, is intentional...
          |import gql from 'graphql-tag';
          |export const {
          |  resetCaches,
          |  disableFragmentWarnings,
          |  enableExperimentalFragmentVariables,
          |  disableExperimentalFragmentVariables
          |} = gql;
          |export { gql };
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot();
      },
      errors: 1,
    },

    // `groups` – `u` flag.
    {
      options: [{ groups: [["^\\p{L}"], ["^\\."]] }],
      code: input`
          |import b from '.';
          |import a from 'ä';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from 'ä';
          |
          |import b from '.';
        `);
      },
      errors: 1,
    },
    {
      options: [{ groups: [["^\\p{L}"], ["^\\."]] }],
      code: input`
          |export {b} from '.';
          |export {a} from 'ä';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from 'ä';
          |
          |export {b} from '.';
        `);
      },
      errors: 1,
    },

    // `groups` – non-matching imports end up last.
    {
      options: [{ groups: [["^\\w"], ["^\\."]] }],
      code: input`
          |import c from '';
          |import b from '.';
          |import a from 'a';
          |import d from '@/a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from 'a';
          |
          |import b from '.';
          |
          |import c from '';
          |import d from '@/a';
        `);
      },
      errors: 1,
    },
    {
      options: [{ groups: [["^\\w"], ["^\\."]] }],
      code: input`
          |export {c} from '';
          |export {e}
          |export {b} from '.';
          |export {a} from 'a';
          |export {d} from '@/a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from 'a';
          |
          |export {b} from '.';
          |
          |export {c} from '';
          |export {d} from '@/a';
          |
          |export {e}
        `);
      },
      errors: 1,
    },

    // `groups` – first longest match wins.
    {
      options: [{ groups: [["^\\w"], ["^\\w{2}"], ["^.{2}"]] }],
      code: input`
          |import c from './';
          |import b from 'bx';
          |import a from 'a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from 'a';
          |
          |import b from 'bx';
          |
          |import c from './';
        `);
      },
      errors: 1,
    },
    {
      options: [{ groups: [["^\\w"], ["^\\w{2}"], ["^.{2}"]] }],
      code: input`
          |export {c} from './';
          |export {b} from 'bx';
          |export {a} from 'a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export {a} from 'a';
          |
          |export {b} from 'bx';
          |
          |export {c} from './';
        `);
      },
      errors: 1,
    },

    // `groups` – side effect imports.
    {
      options: [{ groups: [["^\\w"], ["^\\."], ["^\\u0000"]] }],
      code: input`
          |import '@/';
          |import c from '@/';
          |import b from './';
          |import './';
          |import a from 'a';
          |import 'a';
          |import {} from 'a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from 'a';
          |import {} from 'a';
          |
          |import b from './';
          |
          |import '@/';
          |import './';
          |import 'a';
          |
          |import c from '@/';
        `);
      },
      errors: 1,
    },

    // `groups` – side effect imports keep internal order but are sorted otherwise.
    {
      options: [{ groups: [] }],
      code: input`
          |import b from 'b';
          |import 'c';
          |import d from 'd';
          |import 'a';
          |import '.';
          |import x from './x';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import 'c';
          |import 'a';
          |import '.';
          |import x from './x';
          |import b from 'b';
          |import d from 'd';
        `);
      },
      errors: 1,
    },

    // `groups` – no line breaks between inner array items.
    {
      options: [{ groups: [["^\\w", "^react"], ["^\\."]] }],
      code: input`
          |import react from 'react';
          |import a from 'a';
          |import webpack from "webpack"
          |import Select from 'react-select';
          |import App from './App';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from 'a';
          |import webpack from "webpack"
          |import react from 'react';
          |import Select from 'react-select';
          |
          |import App from './App';
        `);
      },
      errors: 1,
    },

    // Mix of imports and different kinds of exports
    {
      code: input`
          |import x1 from 'b';
          |export * as x2 from 'b'
          |export {c,b, a as d } from 'a';
          |export {c1,b1, a as d1 };
          |
          |export default function add(a, b) {
          |  // adds a and b
          |  return a + b;
          |
          |} /* TODO */ import x3 from "./a"
          |export function useless(a, b) { a, b }
          |export class C /*C*/ extends Parent {
          |  constructor(value) {
          |    this.value = value;
          |  }
          |}
          |export var v1 = 1
          |
          |export let v2 = 2, v2_2 = 22
          |
          |
          |  // Three!
          |export const v3 = 3; /*middle*/ export const v3_2 = 33
          |export const { name1, name2: renamed } = someObject
          |import x0 from "a"
          |import "style.css";
          |export/**/const v4 = // v4
          |
          |  4
          |;[].forEach()
          |var c1, b1, a;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot();
      },
      errors: 1,
    },
  ],
});

const flowTests = {
  valid: [
    // Simple cases.
    `import type a from "a"`,
    `import type {a} from "a"`,
    `import type a, {b} from "a"`,
    `import type {} from "a"`,
    `import type {    } from "a"`,
    `export type T = string;`,
    `export type { T, U as V }; type T = 1; type U = 1;`,

    // typeof
    `import typeof a from "a"`,
    `import typeof {a} from "a"`,
    `import typeof a, {b} from "a"`,
    `import typeof {} from "a"`,
    `import typeof {    } from "a"`,

    // type specifiers.
    `import { type b, type c, a } from "a"`,

    // typeof specifiers.
    `import { typeof b, typeof c, a } from "a"`,

    // Mixed specifiers.
    `import { type c, typeof b, a } from "a"`,

    // Sorted alphabetically.
    input`
          |import type x1 from "a";
          |import typeof x2 from "b"
          |import typeof x3 from "c";
          |import type x4 from "d"
    `,
    input`
          |export type {x1} from "a";
          |export type {x2} from "b"
    `,
    input`
          |import type x1 from "a";
          |import typeof x2 from "b"
          |import typeof x3 from "c";
          |import type x4 from "d"
          |
          |export type {x5} from "a";
          |export type {x6} from "b"
    `,
  ],

  invalid: [
    // Type imports.
    {
      code: input`
          |import react from "react"
          |import type {Z} from "Z";
          |import './global.css';
          |import type {X} from "X";
          |import {truncate, typeof T, type Y, pluralize} from "./utils"
          |import type B from "./B";
          |import type C from "/B";
          |import type E from "@/B";
          |import typeof A from "A";
          |import typeof D from "./D";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import './global.css';
          |
          |import typeof A from "A";
          |import react from "react"
          |import type {X} from "X";
          |import type {Z} from "Z";
          |
          |import type E from "@/B";
          |import type C from "/B";
          |
          |import type B from "./B";
          |import typeof D from "./D";
          |import {type Y, typeof T, pluralize,truncate} from "./utils"
        `);
      },
      errors: 1,
    },

    // Type exports.
    {
      code: input`
          |export type {Z} from "Z";
          |export type Y = 5;
          |export type {X} from "X";
          |export type {B} from "./B";
          |export type {C} from "/B";
          |export type {E} from "@/B";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export type {X} from "X";
          |export type {Z} from "Z";
          |
          |export type {E} from "@/B";
          |export type {C} from "/B";
          |
          |export type {B} from "./B";
          |
          |export type Y = 5;
        `);
      },
      errors: 1,
    },

    // https://github.com/graphql/graphql-js/blob/64b194c6c9b9aaa1c139f1b7c3692a6ef851928e/src/execution/execute.js#L10-L69
    {
      code: input`
          |import { forEach, isCollection } from 'iterall';
          |import { GraphQLError } from '../error/GraphQLError';
          |import { locatedError } from '../error/locatedError';
          |import inspect from '../jsutils/inspect';
          |import invariant from '../jsutils/invariant';
          |import isInvalid from '../jsutils/isInvalid';
          |import isNullish from '../jsutils/isNullish';
          |import isPromise from '../jsutils/isPromise';
          |import memoize3 from '../jsutils/memoize3';
          |import promiseForObject from '../jsutils/promiseForObject';
          |import promiseReduce from '../jsutils/promiseReduce';
          |import type { ObjMap } from '../jsutils/ObjMap';
          |import type { MaybePromise } from '../jsutils/MaybePromise';
          |
          |import { getOperationRootType } from '../utilities/getOperationRootType';
          |import { typeFromAST } from '../utilities/typeFromAST';
          |import { Kind } from '../language/kinds';
          |import {
          |  getVariableValues,
          |  getArgumentValues,
          |  getDirectiveValues,
          |} from './values';
          |import {
          |  isObjectType,
          |  isAbstractType,
          |  isLeafType,
          |  isListType,
          |  isNonNullType,
          |} from '../type/definition';
          |import type {
          |  GraphQLObjectType,
          |  GraphQLOutputType,
          |  GraphQLLeafType,
          |  GraphQLAbstractType,
          |  GraphQLField,
          |  GraphQLFieldResolver,
          |  GraphQLResolveInfo,
          |  ResponsePath,
          |  GraphQLList,
          |} from '../type/definition';
          |import type { GraphQLSchema } from '../type/schema';
          |import {
          |  SchemaMetaFieldDef,
          |  TypeMetaFieldDef,
          |  TypeNameMetaFieldDef,
          |} from '../type/introspection';
          |import {
          |  GraphQLIncludeDirective,
          |  GraphQLSkipDirective,
          |} from '../type/directives';
          |import { assertValidSchema } from '../type/validate';
          |import type {
          |  DocumentNode,
          |  OperationDefinitionNode,
          |  SelectionSetNode,
          |  FieldNode,
          |  FragmentSpreadNode,
          |  InlineFragmentNode,
          |  FragmentDefinitionNode,
          |} from '../language/ast';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { forEach, isCollection } from 'iterall';
          |
          |import { GraphQLError } from '../error/GraphQLError';
          |import { locatedError } from '../error/locatedError';
          |import inspect from '../jsutils/inspect';
          |import invariant from '../jsutils/invariant';
          |import isInvalid from '../jsutils/isInvalid';
          |import isNullish from '../jsutils/isNullish';
          |import isPromise from '../jsutils/isPromise';
          |import type { MaybePromise } from '../jsutils/MaybePromise';
          |import memoize3 from '../jsutils/memoize3';
          |import type { ObjMap } from '../jsutils/ObjMap';
          |import promiseForObject from '../jsutils/promiseForObject';
          |import promiseReduce from '../jsutils/promiseReduce';
          |import type {
          |  DocumentNode,
          |  FieldNode,
          |  FragmentDefinitionNode,
          |  FragmentSpreadNode,
          |  InlineFragmentNode,
          |  OperationDefinitionNode,
          |  SelectionSetNode,
          |} from '../language/ast';
          |import { Kind } from '../language/kinds';
          |import type {
          |  GraphQLAbstractType,
          |  GraphQLField,
          |  GraphQLFieldResolver,
          |  GraphQLLeafType,
          |  GraphQLList,
          |  GraphQLObjectType,
          |  GraphQLOutputType,
          |  GraphQLResolveInfo,
          |  ResponsePath,
          |} from '../type/definition';
          |import {
          |  isAbstractType,
          |  isLeafType,
          |  isListType,
          |  isNonNullType,
          |  isObjectType,
          |} from '../type/definition';
          |import {
          |  GraphQLIncludeDirective,
          |  GraphQLSkipDirective,
          |} from '../type/directives';
          |import {
          |  SchemaMetaFieldDef,
          |  TypeMetaFieldDef,
          |  TypeNameMetaFieldDef,
          |} from '../type/introspection';
          |import type { GraphQLSchema } from '../type/schema';
          |import { assertValidSchema } from '../type/validate';
          |import { getOperationRootType } from '../utilities/getOperationRootType';
          |import { typeFromAST } from '../utilities/typeFromAST';
          |import {
          |  getArgumentValues,
          |  getDirectiveValues,
          |  getVariableValues,
          |} from './values';
        `);
      },
      errors: 1,
    },

    // https://github.com/graphql/graphql-js/blob/f7061fdcf461a2e4b3c78077afaebefc2226c8e3/src/utilities/index.js#L1-L115
    {
      code: input`
          |// @flow strict
          |
          |// Produce the GraphQL query recommended for a full schema introspection.
          |// Accepts optional IntrospectionOptions.
          |export { getIntrospectionQuery } from './getIntrospectionQuery';
          |
          |export type {
          |  IntrospectionOptions,
          |  IntrospectionQuery,
          |  IntrospectionSchema,
          |  IntrospectionType,
          |  IntrospectionInputType,
          |  IntrospectionOutputType,
          |  IntrospectionScalarType,
          |  IntrospectionObjectType,
          |  IntrospectionInterfaceType,
          |  IntrospectionUnionType,
          |  IntrospectionEnumType,
          |  IntrospectionInputObjectType,
          |  IntrospectionTypeRef,
          |  IntrospectionInputTypeRef,
          |  IntrospectionOutputTypeRef,
          |  IntrospectionNamedTypeRef,
          |  IntrospectionListTypeRef,
          |  IntrospectionNonNullTypeRef,
          |  IntrospectionField,
          |  IntrospectionInputValue,
          |  IntrospectionEnumValue,
          |  IntrospectionDirective,
          |} from './getIntrospectionQuery';
          |
          |// Gets the target Operation from a Document.
          |export { getOperationAST } from './getOperationAST';
          |
          |// Gets the Type for the target Operation AST.
          |export { getOperationRootType } from './getOperationRootType';
          |
          |// Convert a GraphQLSchema to an IntrospectionQuery.
          |export { introspectionFromSchema } from './introspectionFromSchema';
          |
          |// Build a GraphQLSchema from an introspection result.
          |export { buildClientSchema } from './buildClientSchema';
          |
          |// Build a GraphQLSchema from GraphQL Schema language.
          |export { buildASTSchema, buildSchema } from './buildASTSchema';
          |export type { BuildSchemaOptions } from './buildASTSchema';
          |
          |// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
          |export {
          |  extendSchema,
          |  // @deprecated: Get the description from a schema AST node and supports legacy
          |  // syntax for specifying descriptions - will be removed in v16.
          |  getDescription,
          |} from './extendSchema';
          |
          |// Sort a GraphQLSchema.
          |export { lexicographicSortSchema } from './lexicographicSortSchema';
          |
          |// Print a GraphQLSchema to GraphQL Schema language.
          |export {
          |  printSchema,
          |  printType,
          |  printIntrospectionSchema,
          |} from './printSchema';
          |
          |// Create a GraphQLType from a GraphQL language AST.
          |export { typeFromAST } from './typeFromAST';
          |
          |// Create a JavaScript value from a GraphQL language AST with a type.
          |export { valueFromAST } from './valueFromAST';
          |
          |// Create a JavaScript value from a GraphQL language AST without a type.
          |export { valueFromASTUntyped } from './valueFromASTUntyped';
          |
          |// Create a GraphQL language AST from a JavaScript value.
          |export { astFromValue } from './astFromValue';
          |
          |// A helper to use within recursive-descent visitors which need to be aware of
          |// the GraphQL type system.
          |export { TypeInfo, visitWithTypeInfo } from './TypeInfo';
          |
          |// Coerces a JavaScript value to a GraphQL type, or produces errors.
          |export { coerceInputValue } from './coerceInputValue';
          |
          |// Concatenates multiple AST together.
          |export { concatAST } from './concatAST';
          |
          |// Separates an AST into an AST per Operation.
          |export { separateOperations } from './separateOperations';
          |
          |// Strips characters that are not significant to the validity or execution
          |// of a GraphQL document.
          |export { stripIgnoredCharacters } from './stripIgnoredCharacters';
          |
          |// Comparators for types
          |export {
          |  isEqualType,
          |  isTypeSubTypeOf,
          |  doTypesOverlap,
          |} from './typeComparators';
          |
          |// Asserts that a string is a valid GraphQL name
          |export { assertValidName, isValidNameError } from './assertValidName';
          |
          |// Compares two GraphQLSchemas and detects breaking changes.
          |export {
          |  BreakingChangeType,
          |  DangerousChangeType,
          |  findBreakingChanges,
          |  findDangerousChanges,
          |} from './findBreakingChanges';
          |export type { BreakingChange, DangerousChange } from './findBreakingChanges';
          |
          |// Report all deprecated usage within a GraphQL document.
          |export { findDeprecatedUsages } from './findDeprecatedUsages';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// @flow strict
          |
          |// Produce the GraphQL query recommended for a full schema introspection.
          |// Accepts optional IntrospectionOptions.
          |// Asserts that a string is a valid GraphQL name
          |export { assertValidName, isValidNameError } from './assertValidName';
          |// Create a GraphQL language AST from a JavaScript value.
          |export { astFromValue } from './astFromValue';
          |export type { BuildSchemaOptions } from './buildASTSchema';
          |// Build a GraphQLSchema from GraphQL Schema language.
          |export { buildASTSchema, buildSchema } from './buildASTSchema';
          |// Build a GraphQLSchema from an introspection result.
          |export { buildClientSchema } from './buildClientSchema';
          |// Coerces a JavaScript value to a GraphQL type, or produces errors.
          |export { coerceInputValue } from './coerceInputValue';
          |// Concatenates multiple AST together.
          |export { concatAST } from './concatAST';
          |// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
          |export {
          |  extendSchema,
          |  // @deprecated: Get the description from a schema AST node and supports legacy
          |  // syntax for specifying descriptions - will be removed in v16.
          |  getDescription,
          |} from './extendSchema';
          |export type { BreakingChange, DangerousChange } from './findBreakingChanges';
          |// Compares two GraphQLSchemas and detects breaking changes.
          |export {
          |  BreakingChangeType,
          |  DangerousChangeType,
          |  findBreakingChanges,
          |  findDangerousChanges,
          |} from './findBreakingChanges';
          |// Report all deprecated usage within a GraphQL document.
          |export { findDeprecatedUsages } from './findDeprecatedUsages';
          |export type {
          |  IntrospectionDirective,
          |  IntrospectionEnumType,
          |  IntrospectionEnumValue,
          |  IntrospectionField,
          |  IntrospectionInputObjectType,
          |  IntrospectionInputType,
          |  IntrospectionInputTypeRef,
          |  IntrospectionInputValue,
          |  IntrospectionInterfaceType,
          |  IntrospectionListTypeRef,
          |  IntrospectionNamedTypeRef,
          |  IntrospectionNonNullTypeRef,
          |  IntrospectionObjectType,
          |  IntrospectionOptions,
          |  IntrospectionOutputType,
          |  IntrospectionOutputTypeRef,
          |  IntrospectionQuery,
          |  IntrospectionScalarType,
          |  IntrospectionSchema,
          |  IntrospectionType,
          |  IntrospectionTypeRef,
          |  IntrospectionUnionType,
          |} from './getIntrospectionQuery';
          |export { getIntrospectionQuery } from './getIntrospectionQuery';
          |// Gets the target Operation from a Document.
          |export { getOperationAST } from './getOperationAST';
          |// Gets the Type for the target Operation AST.
          |export { getOperationRootType } from './getOperationRootType';
          |// Convert a GraphQLSchema to an IntrospectionQuery.
          |export { introspectionFromSchema } from './introspectionFromSchema';
          |// Sort a GraphQLSchema.
          |export { lexicographicSortSchema } from './lexicographicSortSchema';
          |// Print a GraphQLSchema to GraphQL Schema language.
          |export {
          |  printIntrospectionSchema,
          |  printSchema,
          |  printType,
          |} from './printSchema';
          |// Separates an AST into an AST per Operation.
          |export { separateOperations } from './separateOperations';
          |// Strips characters that are not significant to the validity or execution
          |// of a GraphQL document.
          |export { stripIgnoredCharacters } from './stripIgnoredCharacters';
          |// Comparators for types
          |export {
          |  doTypesOverlap,
          |  isEqualType,
          |  isTypeSubTypeOf,
          |} from './typeComparators';
          |// Create a GraphQLType from a GraphQL language AST.
          |export { typeFromAST } from './typeFromAST';
          |// A helper to use within recursive-descent visitors which need to be aware of
          |// the GraphQL type system.
          |export { TypeInfo, visitWithTypeInfo } from './TypeInfo';
          |// Create a JavaScript value from a GraphQL language AST with a type.
          |export { valueFromAST } from './valueFromAST';
          |// Create a JavaScript value from a GraphQL language AST without a type.
          |export { valueFromASTUntyped } from './valueFromASTUntyped';
        `);
      },
      errors: 1,
    },
  ],
};

const typescriptTests = {
  valid: [
    // Simple cases.
    `import type a from "a"`,
    `import type {a} from "a"`,
    `import type {} from "a"`,
    `import type {    } from "a"`,
    `export type T = string;`,
    `export type { T, U as V }; type T = 1; type U = 1;`,

    // Sorted alphabetically.
    input`
          |import type x1 from "a";
          |import type x2 from "b"
    `,
    input`
          |export type {x1} from "a";
          |export type {x2} from "b"
    `,
    input`
          |import type x1 from "a";
          |import type x2 from "b"
          |
          |export type {x3} from "a";
          |export type {x4} from "b"
    `,
  ],
  invalid: [
    // Type imports.
    {
      code: input`
          |import React from "react";
          |import Button from "../Button";
          |import type {target, type as tipe, Button} from "../Button";
          |
          |import styles from "./styles.css";
          |import { getUser } from "../../api";
          |
          |import PropTypes from "prop-types";
          |import { /* X */ } from "prop-types";
          |import classnames from "classnames";
          |import { truncate, formatNumber } from "../../utils";
          |import type X from "../Button";
          |
          |function pluck<T, K extends keyof T>(o: T, names: K[]): T[K][] {
          |  return names.map(n => o[n]);
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import classnames from "classnames";
          |import PropTypes from "prop-types";
          |import { /* X */ } from "prop-types";
          |import React from "react";
          |
          |import { getUser } from "../../api";
          |import { formatNumber,truncate } from "../../utils";
          |import type {Button,target, type as tipe} from "../Button";
          |import type X from "../Button";
          |import Button from "../Button";
          |import styles from "./styles.css";
          |
          |function pluck<T, K extends keyof T>(o: T, names: K[]): T[K][] {
          |  return names.map(n => o[n]);
          |}
        `);
      },
      errors: 1,
    },

    // Type exports.
    {
      code: input`
          |export type {Z} from "Z";
          |export type Y = 5;
          |export type {X} from "X";
          |export type {B} from "./B";
          |export type {C} from "/B";
          |export type {E} from "@/B";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export type {X} from "X";
          |export type {Z} from "Z";
          |
          |export type {E} from "@/B";
          |export type {C} from "/B";
          |
          |export type {B} from "./B";
          |
          |export type Y = 5;
        `);
      },
      errors: 1,
    },

    // https://github.com/apollographql/apollo-client/blob/39942881567ff9825a0f17bbf114ec441590f8bb/src/core/QueryInfo.ts#L1-L39
    {
      code: input`
          |import React from "react";
          |import { DocumentNode, GraphQLError } from 'graphql';
          |import { equal } from "@wry/equality";
          |
          |import { Cache } from '../cache/core/types/Cache';
          |import { ApolloCache } from '../cache/core/cache';
          |import { WatchQueryOptions } from './watchQueryOptions';
          |import { ObservableQuery } from './ObservableQuery';
          |import { QueryListener } from './types';
          |import { FetchResult } from '../link/core/types';
          |import { ObservableSubscription } from '../utilities/observables/Observable';
          |import { isNonEmptyArray } from '../utilities/common/arrays';
          |import { graphQLResultHasError } from '../utilities/common/errorHandling';
          |import {
          |  NetworkStatus,
          |  isNetworkRequestInFlight,
          |} from './networkStatus';
          |import { ApolloError } from '../errors/ApolloError';
          |
          |export type QueryStoreValue = Pick<QueryInfo,
          |  | "variables"
          |  | "networkStatus"
          |  | "networkError"
          |  | "graphQLErrors"
          |  >;
          |
          |// A QueryInfo object represents a single query managed by the
          |// QueryManager, which tracks all QueryInfo objects by queryId in its...
          |export class QueryInfo {
          |  listeners = new Set<QueryListener>();
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { equal } from "@wry/equality";
          |import { DocumentNode, GraphQLError } from 'graphql';
          |import React from "react";
          |
          |import { ApolloCache } from '../cache/core/cache';
          |import { Cache } from '../cache/core/types/Cache';
          |import { ApolloError } from '../errors/ApolloError';
          |import { FetchResult } from '../link/core/types';
          |import { isNonEmptyArray } from '../utilities/common/arrays';
          |import { graphQLResultHasError } from '../utilities/common/errorHandling';
          |import { ObservableSubscription } from '../utilities/observables/Observable';
          |import {
          |  isNetworkRequestInFlight,
          |  NetworkStatus,
          |} from './networkStatus';
          |import { ObservableQuery } from './ObservableQuery';
          |import { QueryListener } from './types';
          |import { WatchQueryOptions } from './watchQueryOptions';
          |
          |export type QueryStoreValue = Pick<QueryInfo,
          |  | "variables"
          |  | "networkStatus"
          |  | "networkError"
          |  | "graphQLErrors"
          |  >;
          |// A QueryInfo object represents a single query managed by the
          |// QueryManager, which tracks all QueryInfo objects by queryId in its...
          |export class QueryInfo {
          |  listeners = new Set<QueryListener>();
          |}
        `);
      },
      errors: 1,
    },
  ],
};

const javascriptRuleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015, sourceType: "module" },
});

const flowRuleTester = new RuleTester({
  parser: require.resolve("babel-eslint"),
});

const typescriptRuleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: { sourceType: "module" },
});

// Run `baseTests` with all parsers, but only use `.toMatchInlineSnapshot` with
// the first one, because Jest can’t update the snapshots otherwise.
const expect2 = (...args) => {
  const ret = expect(...args);
  ret.toMatchInlineSnapshot = (string) =>
    ret.toBe(strip(string, { keepPipes: true }));
  return ret;
};
javascriptRuleTester.run("JavaScript", plugin.rules.sort, baseTests(expect));
flowRuleTester.run("Flow", plugin.rules.sort, baseTests(expect2));
typescriptRuleTester.run("TypeScript", plugin.rules.sort, baseTests(expect2));

flowRuleTester.run("Flow-specific", plugin.rules.sort, flowTests);

typescriptRuleTester.run(
  "TypeScript-specific",
  plugin.rules.sort,
  typescriptTests
);
