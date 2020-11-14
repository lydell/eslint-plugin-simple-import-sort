"use strict";

const { RuleTester } = require("eslint");

const plugin = require("../src");
const { input, setup } = require("./helpers");

const expect2 = setup(expect);

const baseTests = (expect) => ({
  valid: [
    // Simple cases.
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

    // Sorted alphabetically.
    input`
          |export {x1} from "a";
          |export {x2} from "b"
    `,

    // Opt-out.
    input`
          |// eslint-disable-next-line
          |export {x2} from "b"
          |export {x1} from "a";
    `,

    // Whitespace before comment at last specifier should stay.
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
          |export {a} from "a"    
          |export {b} from "b";    
          |export {c} from "c";  /* comment */  
    `,
  ],

  invalid: [
    // Sorting alphabetically.
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
  ],
});

const flowTests = {
  valid: [
    // Simple cases.
    `export type T = string;`,
    `export type { T, U as V }; type T = 1; type U = 1;`,
  ],

  invalid: [
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
          |export type {Z} from "Z";
          |export type Y = 5;
          |export type {B} from "./B";
          |export type {C} from "/B";
          |export type {E} from "@/B";
          |export type {X} from "X";
        `);
      },
      errors: 1,
    },
  ],
};

const typescriptTests = {
  valid: [
    // Simple cases.
    `export type T = string;`,
    `export type { T, U as V }; type T = 1; type U = 1;`,

    // Sorted alphabetically.
    input`
          |export type {x1} from "a";
          |export type {x2} from "b"
    `,
  ],
  invalid: [
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
          |export type {Z} from "Z";
          |export type Y = 5;
          |export type {B} from "./B";
          |export type {C} from "/B";
          |export type {E} from "@/B";
          |export type {X} from "X";
        `);
      },
      errors: 1,
    },
  ],
};

const javascriptRuleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
});

const flowRuleTester = new RuleTester({
  parser: require.resolve("babel-eslint"),
});

const typescriptRuleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: { sourceType: "module" },
});

javascriptRuleTester.run("JavaScript", plugin.rules.exports, baseTests(expect));

flowRuleTester.run("Flow", plugin.rules.exports, baseTests(expect2));

typescriptRuleTester.run(
  "TypeScript",
  plugin.rules.exports,
  baseTests(expect2)
);

flowRuleTester.run("Flow-specific", plugin.rules.exports, flowTests);

typescriptRuleTester.run(
  "TypeScript-specific",
  plugin.rules.exports,
  typescriptTests
);
