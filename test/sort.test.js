"use strict";

const assert = require("assert");

const { RuleTester } = require("eslint");

const plugin = require("../");

// Hack to allow using `.toMatchInlineSnapshot` for `output` in `RuleTester`.
// https://github.com/eslint/eslint/blob/e18c827cc12cb1c52e5d0aa993f572cb56238704/lib/testers/rule-tester.js#L569
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
  test: value => typeof value === "string",
  print: value => value,
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

const baseTests = expect => ({
  valid: [
    // Simple cases.
    `import "a"`,
    `import a from "a"`,
    `import {a} from "a"`,
    `import a, {b} from "a"`,
    `import {} from "a"`,
    `import {    } from "a"`,

    // Side-effect only imports are kept in the original order.
    input`
          |import "b";
          |import "a"
    `,

    // Sorted alphabetically.
    input`
          |import x1 from "a";
          |import x2 from "b"
    `,

    // Opt-out.
    input`
          |// eslint-disable-next-line
          |import x2 from "b"
          |import x1 from "a";
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

    // Accidental trailing spaces doesn’t produce a sorting error.
    input`
          |import a from "a"    
          |import b from "b";    
          |import c from "c";  /* comment */  
    `,
  ],

  invalid: [
    // Sorting alphabetically.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a";
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a";
          |import x2 from "b"
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a"
          |import x2 from "b"
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
      output: actual => {
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
      output: actual => {
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

    // Comments around start-of-line guarding semicolon.
    {
      code: input`
          |import x2 from "b"
          |import x1 from "a" // a
          |
          |;/* comment */[].forEach()
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a" // a
          |import x2 from "b"
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import x1 from "a"
          |;
          |import x2 from "b"
        `);
      },
      errors: 1,
    },

    // Sorting specifiers.
    {
      code: `import { e, b, a as c } from "specifiers"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import { a as c,b, e } from "specifiers"`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with default import.
    {
      code: `import d, { e, b, a as c } from "specifiers-default"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import d, { a as c,b, e } from "specifiers-default"`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with trailing comma.
    {
      code: `import d, { e, b, a as c, } from "specifiers-trailing-comma"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import d, { a as c,b, e,  } from "specifiers-trailing-comma"`
        );
      },
      errors: 1,
    },

    // Sorting specifiers with renames.
    {
      code: `import { a as c, a as b2, b, a } from "specifiers-renames"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,a as b2, a as c, b } from "specifiers-renames"`
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
      output: actual => {
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

    // No spaces in specifiers.
    {
      code: `import {e,b,a as c} from "specifiers-no-spaces"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import {a as c,b,e} from "specifiers-no-spaces"`
        );
      },
      errors: 1,
    },

    // Space before specifiers.
    {
      code: `import { b,a} from "specifiers-no-space-before"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,b} from "specifiers-no-space-before"`
        );
      },
      errors: 1,
    },

    // Space after specifiers.
    {
      code: `import {b,a } from "specifiers-no-space-after"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import {a,b } from "specifiers-no-space-after"`
        );
      },
      errors: 1,
    },

    // Space after specifiers.
    {
      code: `import {b,a, } from "specifiers-no-space-after-trailing"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import {a,b, } from "specifiers-no-space-after-trailing"`
        );
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
      output: actual => {
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
      output: actual => {
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

    // Sorting specifiers with comment between.
    {
      code: `import { b /* b */, a } from "specifiers-comment-between"`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `import { a,b /* b */ } from "specifiers-comment-between"`
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
      output: actual => {
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
      output: actual => {
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

    // Sorting specifiers with multiline end comment.
    {
      code: input`
          |import {
          |  b,
          |  a /*
          |  after */
          |} from "specifiers-multiline-end-comment"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,   b/*
          |  after */
          |} from "specifiers-multiline-end-comment"
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
      output: actual => {
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

    // Sorting specifiers with multiline end comment and no newline.
    {
      code: input`
          |import {
          |  b,
          |  a /*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,   b/*
          |  after */ } from "specifiers-multiline-end-comment-no-newline"
        `);
      },
      errors: 1,
    },

    // Sorting specifiers with lots of comments.
    {
      code: `/*1*//*2*/import/*3*/def,/*4*/{/*{*/e/*e1*/,/*e2*//*e3*/b/*b1*/,/*b2*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(
          `/*1*//*2*/import/*3*/def,/*4*/{/*{*/a/*a1*/as/*a2*/c/*a3*/,/*a4*/b/*b1*/,/*b2*/e/*e1*/,/*e2*//*e3*/}/*5*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/`
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
      output: actual => {
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

    // No empty line after last specifier due to newline before comma.
    {
      code: input`
          |import {
          |  b/*b*/
          |  ,
          |  a
          |} from "specifiers-blank";
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |  a,
          |  b/*b*/
          |  } from "specifiers-blank";
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
      output: actual => {
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

    // Indent: 0.
    {
      code: input`
          |import {
          |b,
          |a,
          |} from "specifiers-indent-0"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |a,
          |b,
          |} from "specifiers-indent-0"
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |    a,
          |    b,
          |} from "specifiers-indent-4"
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |→a,
          |→b,
          |} from "specifiers-indent-tab"
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
      output: actual => {
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

    // Several chunks.
    {
      code: input`
          |require("c");
          |
          |import x1 from "b"
          |import x2 from "a"
          |require("c");
          |
          |import x3 from "b"
          |import x4 from "a" // x4
          |
          |// c1
          |require("c");
          |import x5 from "b"
          |// x6-1
          |import x6 from "a" /* after
          |*/
          |
          |require("c"); import x7 from "b"; import x8 from "a"; require("c")
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |require("c");
          |
          |import x2 from "a"
          |import x1 from "b"
          |require("c");
          |
          |import x4 from "a" // x4
          |import x3 from "b"
          |
          |// c1
          |require("c");
          |// x6-1
          |import x6 from "a" 
          |import x5 from "b"/* after
          |*/
          |
          |require("c"); import x8 from "a"; 
          |import x7 from "b"; require("c")
        `);
      },
      errors: 4,
    },

    // Original order is preserved for duplicate imports.
    {
      code: input`
          |import b from "b"
          |import a1 from "a"
          |import {a2} from "a"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import a1 from "a"
          |import {a2} from "a"
          |import b from "b"
        `);
      },
      errors: 1,
    },

    // Original order is preserved for duplicate imports (reversed example).
    {
      code: input`
          |import b from "b"
          |import {a2} from "a"
          |import a1 from "a"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {a2} from "a"
          |import a1 from "a"
          |import b from "b"
        `);
      },
      errors: 1,
    },

    // Webpack loader syntax
    {
      code: input`
          |import x1 from "webpack-loader!b"
          |import x2 from "webpack-loader!./c"
          |import x3 from "webpack-loader!/d"
          |import x4 from 'loader1!loader2?query!loader3?{"key":"value!"}!a'
          |import x5 from "webpack-loader!b"
          |import x6 from "other-loader!b"
          |import x7 from "b"
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import x4 from 'loader1!loader2?query!loader3?{"key":"value!"}!a'
          |import x7 from "b"
          |import x6 from "other-loader!b"
          |import x1 from "webpack-loader!b"
          |import x5 from "webpack-loader!b"
          |
          |import x3 from "webpack-loader!/d"
          |
          |import x2 from "webpack-loader!./c"
        `);
      },
      errors: 1,
    },

    // Special characters sorting order.
    {
      code: input`
          |import {} from "";
          |import {} from ".";
          |import {} from "loader!.";
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {} from "@storybook/react";
          |import {} from "@storybook/react/something";
          |import {} from "1";
          |import {} from "async";
          |import {} from "fs";
          |import {} from "fs/something";
          |import {} from "lodash/fp";
          |import {} from "react";
          |
          |import {} from "";
          |import {} from "1*";
          |import {} from "a*";
          |import {} from "Fs";
          |import {} from "http://example.com/script.js";
          |import {} from "https://example.com/script.js";
          |import {} from "...";
          |import {} from ".../";
          |import {} from ".a";
          |import {} from "@/components/Alert"
          |import {} from "@/components/error.vue"
          |import {} from "/";
          |import {} from "/a";
          |import {} from "/a/b";
          |import {} from "#/test"
          |import {} from "~/test"
          |
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
          |import {} from "loader!.";
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
      output: actual => {
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

    // Line comment and code after.
    {
      code: input`
          |import b from "b"; // b
          |import a from "a"; code();
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; 
          |import b from "b"; // b
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; 
          |import b from "b"; // b
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import a from "a"; /* a */
          |import b from "b"; // b
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
      output: actual => {
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
          messageId: "sort",
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
      output: actual => {
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
      output: actual => {
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

    // Collapse blank lines inside import statements.
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
      output: actual => {
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

    // Collapse blank lines inside empty specifier list.
    {
      code: input`
          |import {
          |
          |    } from "specifiers-empty"
`,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
          |    } from "specifiers-empty"
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import {
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
      output: actual => {
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
      output: actual => {
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
      output: actual => {
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
      output: actual => {
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
      output: actual => {
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
      output: actual => {
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
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import './global.css';
          |
          |import react from "react"
          |
          |import typeof A from "A";
          |import type {X} from "X";
          |import type {Z} from "Z";
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

    // All at once.
    {
      code: input`
          |import A from "webpack!a";
          |import B from "webpack!./a";
          |import type C from "a";
          |import D from "a";
          |import typeof E from "a";
          |import type F from "flow!./a";
          |import type G from "flow!a";
          |import typeof H from "a";
          |import type I from "./a";
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import type C from "a";
          |import type G from "flow!a";
          |import typeof E from "a";
          |import typeof H from "a";
          |import D from "a";
          |import A from "webpack!a";
          |
          |import type I from "./a";
          |import type F from "flow!./a";
          |import B from "webpack!./a";
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
      output: actual => {
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
  ],
};

const typescriptTests = {
  valid: [],
  invalid: [
    {
      code: input`
          |import React from "react";
          |import Button from "../Button";
          |
          |import styles from "./styles.css";
          |import { getUser } from "../../api";
          |
          |import PropTypes from "prop-types";
          |import classnames from "classnames";
          |import { truncate, formatNumber } from "../../utils";
          |
          |function pluck<T, K extends keyof T>(o: T, names: K[]): T[K][] {
          |  return names.map(n => o[n]);
          |}
      `,
      output: actual => {
        expect(actual).toMatchInlineSnapshot(`
          |import classnames from "classnames";
          |import PropTypes from "prop-types";
          |import React from "react";
          |
          |import { getUser } from "../../api";
          |import { formatNumber,truncate } from "../../utils";
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
  ret.toMatchInlineSnapshot = string =>
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
