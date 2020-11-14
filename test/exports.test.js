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
          |export type { BuildSchemaOptions } from './buildASTSchema';
          |export { buildASTSchema, buildSchema } from './buildASTSchema';
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
          |  printIntrospectionSchema,
          |  printSchema,
          |  printType,
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
          |  doTypesOverlap,
          |  isEqualType,
          |  isTypeSubTypeOf,
          |} from './typeComparators';
          |
          |// Asserts that a string is a valid GraphQL name
          |export { assertValidName, isValidNameError } from './assertValidName';
          |
          |// Compares two GraphQLSchemas and detects breaking changes.
          |export type { BreakingChange, DangerousChange } from './findBreakingChanges';
          |export {
          |  BreakingChangeType,
          |  DangerousChangeType,
          |  findBreakingChanges,
          |  findDangerousChanges,
          |} from './findBreakingChanges';
          |
          |// Report all deprecated usage within a GraphQL document.
          |export { findDeprecatedUsages } from './findDeprecatedUsages';
        `);
      },
      errors: 5,
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
