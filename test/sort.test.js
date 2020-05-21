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

function ifSupported(regexString, fallbackRegexString) {
  try {
    RegExp(regexString, "u");
    return regexString;
  } catch (_error) {
    return fallbackRegexString;
  }
}

const baseTests = (expect) => ({
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

    // Side-effect only imports use a stable sort (issure #34).
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
      output: (actual) => {
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
      output: (actual) => {
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
      output: (actual) => {
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
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import {a2} from "a"
          |import a1 from "a"
          |import b from "b"
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

    // `groups` – `u` flag.
    // Node.js 8 supports `u` but not `\p{L}`.
    {
      options: [{ groups: [[ifSupported("^\\p{L}", "^[^.]")], ["^\\."]] }],
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
  ],
};

const typescriptTests = {
  valid: [],
  invalid: [
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
    // Sorts exports by source alphabetically (handles aliased all export)
    // Support for this syntax will be included in es2020, though the javascript parser
    // does not yet support the alias syntax. Typescript 3.8 supports this however.
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#export-star-as-namespace-syntax
    {
      code: input`
          |export * as q from 'q';
          |export * as a from 'a';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export * as a from 'a';
          |export * as q from 'q';
        `);
      },
      errors: 1,
    },
  ],
};

const baseExportTests = (expect) => ({
  valid: [
    // Supported exports: those with a source  i.e. "export ... from './source'"
    // Unsupported exports are not sorted
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export#Syntax

    // Unsupported: unassigned local variable declarations
    {
      code: input`
          |export var name4, name3;
          |export let name2, name1;
      `,
    },
    // Unsupported: assigned local variable declarations
    {
      code: input`
          |export const name5 = 'Steve';
          |export var name4 = 'Doe', name3 = 'Jane';
          |export let name2 = 'John', name1 = 'Smith';
      `,
    },
    // Unsupported: local functions
    {
      code: input`
          |export function b() {}
          |export function a() {}
      `,
    },
    // Unsupported: local classes
    {
      code: input`
          |export class b {}
          |export class a {}
      `,
    },
    // Unsupported: export list
    {
      code: input`
          |const name2 = 'Smith', name1 = 'John';
          |export { name2, name1 }
      `,
    },
    // Unsupported: export list with renames
    {
      code: input`
          |const name2 = 'Smith', name1 = 'John';
          |export { name2 as b, name1 as a }
      `,
    },
    // Unsupported: destructuring export with renames
    {
      code: input`
          |const o = { name1: 'John', name2: 'Smith' };
          |export const { name1, name2: bar } = o;
      `,
    },
    // Unsupported: export default expression
    {
      code: `export default 1 === '1';`,
    },
    // Unsupported: export default function
    {
      code: `export default function () {}`,
    },
    // Unsupported: export default class
    {
      code: `export default class {}`,
    },
    // Unsupported: export default generator
    {
      code: `export default function* (i) { yield i; }`,
    },
    // Unsupported: export default named function
    {
      code: `export default function myFunction() {}`,
    },
    // Unsupported: export default named class
    {
      code: `export default class MyClass {}`,
    },
    // Unsupported: export default named generator
    {
      code: `export default function* myGenerator (i) { yield i; }`,
    },
    // Unsupported: export default in specifier list
    {
      code: input`
          |const name2 = 'Smith', name1 = 'John';
          |export { name1 as default, name2 }
      `,
    },
    // Unsupported: module.exports style export (single-line)
    {
      code: `module.exports = { b: 2, a: 1 }`,
    },
    // Unsupported: module.exports style export (multi-line)
    // derived example from https://github.com/puppeteer/puppeteer/blob/master/src/api.ts
    {
      code: input`
          |module.exports = {
          |Browser: require('./Browser').Browser,
          |BrowserContext: require('./Browser').BrowserContext,
          |Accessibility: require('./Accessibility').Accessibility,
          |}
      `,
    },
    // Unsupported: multiline export statements without a source.
    // derived from https://github.com/facebook/react/blob/master/packages/react-dom/src/client/ReactDOM.js
    {
      code: input`
          |let createPortal, batchedUpdates, flushSync, Internals, ReactVersion, findDOMNode, hydrate, 
          |render, unmountComponentAtNode, createRoot, createBlockingRoot, flushControlled, scheduleHydration, 
          |renderSubtreeIntoContainer, unstable_createPortal, createEventHandle;
          |
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
          |  // TODO: remove in React 17.
          |  unstable_createPortal,
          |  // enableCreateEventHandleAPI
          |  createEventHandle as unstable_createEventHandle,
          |};
      `,
    },

    // Opt-out - does not sort line
    {
      code: input`
          |// eslint-disable-next-line
          |export { c } from "c"
          |export { b } from "b"
          |export { a } from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// eslint-disable-next-line
          |export { c } from "c"
          |export { b } from "b"
          |export { a } from "a"
        `);
      },
    },
  ],
  invalid: [
    // Sorts by source alphabetically
    {
      code: input`
          |export * from "b";
          |export * from "a";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export * from "a";
          |export * from "b";
        `);
      },
      errors: 1,
    },

    // Sorts by source alphabetically (handles default exports)
    {
      code: input`
          |export * from "b";
          |export { default } from "a";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { default } from "a";
          |export * from "b";
        `);
      },
      errors: 1,
    },

    // Does not sort exports prior to imports
    {
      code: input`
          |export { z } from "z";
          |import { c } from "c";
          |export { b } from "b";
          |export { a } from "a";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { c } from "c";
          |
          |export { a } from "a";
          |export { b } from "b";
          |export { z } from "z";
        `);
      },
      errors: 1,
    },

    // Sourceless exports sort after exports within a chunk, but retain their
    // original order relative to other sourceless exports
    {
      code: input`
          |export { w } from "w";
          |import { z } from "z";
          |export const b = 5;
          |export const a = b;
          |export { y } from "y";
          |export { x } from "x";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |import { z } from "z";
          |
          |export { w } from "w";
          |export { x } from "x";
          |export { y } from "y";
          |
          |export const b = 5;
          |export const a = b;
        `);
      },
      errors: 1,
    },

    // sorts within chunks (single line code between)
    {
      code: input`
          |export { d } from "d";
          |export { a } from "a";
          |code();
          |export { c } from "c";
          |export { b } from "b";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { a } from "a";
          |export { d } from "d";
          |code();
          |export { b } from "b";
          |export { c } from "c";
        `);
      },
      errors: 2,
    },

    // sorts within chunks (single line code between and after)
    {
      code: input`
          |export { d } from "d";
          |export { a } from "a";
          |code();
          |export { c } from "c";
          |export { b } from "b";
          |code();
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { a } from "a";
          |export { d } from "d";
          |code();
          |export { b } from "b";
          |export { c } from "c";
          |code();
        `);
      },
      errors: 2,
    },

    // sorts within chunks (multi-line code between)
    {
      code: input`
          |export { d } from "d";
          |export { a } from "a";
          |code();
          |code();
          |export { c } from "c";
          |export { b } from "b";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { a } from "a";
          |export { d } from "d";
          |code();
          |code();
          |export { b } from "b";
          |export { c } from "c";
        `);
      },
      errors: 2,
    },

    // Sorts specifiers by name.
    {
      code: `export { c, b, a } from "specifiers"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b, c } from "specifiers"`
        );
      },
      errors: 1,
    },

    // Sorts specifiers by name then alias.
    {
      code: `export { c, a, a as z, a as y } from "specifiers"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a, a as y,a as z, c } from "specifiers"`
        );
      },
      errors: 1,
    },

    // Sorts specifiers by name then alias - handles multiline export statements.
    {
      code: input`
          |export { 
          |// comment first and above c
          |c, 
          |// comment1 above a
          |// comment2 above a
          |a, 
          |a as z, 
          |a as y 
          |// comment last
          |} from "specifiers"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { 
          |// comment1 above a
          |// comment2 above a
          |a, 
          |a as y, 
          |a as z, 
          |// comment first and above c
          |c
          |// comment last
          |} from "specifiers"
        `);
      },
      errors: 1,
    },

    // Comments after export are moved with it (named exports)
    {
      code: input`
          |export { b } from "b"; // b
          |export { a } from "a"; /* a */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { a } from "a"; /* a */
          |export { b } from "b"; // b
        `);
      },
      errors: 1,
    },

    // Comments after export are moved with it (all exports)
    {
      code: input`
          |export * from "b"; // b
          |export * from "a"; /* a */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export * from "a"; /* a */
          |export * from "b"; // b
        `);
      },
      errors: 1,
    },

    // Line comments before export are unchanged
    // Derived from https://github.com/parcel-bundler/parcel/blob/v2/packages/utils/ts-utils/src/index.js
    {
      code: input`
          |// @flow
          |export * from './FSHost';
          |export * from './CompilerHost';
          |export * from './ParseConfigHost';
          |export * from './LanguageServiceHost';
          |export * from './loadTSConfig';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// @flow
          |export * from './CompilerHost';
          |export * from './FSHost';
          |export * from './LanguageServiceHost';
          |export * from './loadTSConfig';
          |export * from './ParseConfigHost';
        `);
      },
      errors: 1,
    },

    // Block comments before export are unchanged
    {
      code: input`
          |/* exports below */
          |export * from "b"; // b
          |export * from "a"; /* a */
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |/* exports below */
          |export * from "a"; /* a */
          |export * from "b"; // b
        `);
      },
      errors: 1,
    },
  ],
});

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

// Run tests with all parsers, but only use `.toMatchInlineSnapshot` with
// the first one, because Jest can’t update the snapshots otherwise.
const expect2 = (...args) => {
  const ret = expect(...args);
  ret.toMatchInlineSnapshot = (string) =>
    ret.toBe(strip(string, { keepPipes: true }));
  return ret;
};

const runTests = (tests) => {
  javascriptRuleTester.run("JavaScript", plugin.rules.sort, tests(expect));
  flowRuleTester.run("Flow", plugin.rules.sort, tests(expect2));
  typescriptRuleTester.run("TypeScript", plugin.rules.sort, tests(expect2));
};

runTests(baseTests);
runTests(baseExportTests);

flowRuleTester.run("Flow-specific", plugin.rules.sort, flowTests);

typescriptRuleTester.run(
  "TypeScript-specific",
  plugin.rules.sort,
  typescriptTests
);
