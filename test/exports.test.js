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

    // Commenting out an export doesn’t produce a sorting error.
    input`
          |export {a} from "a"
          |// export {b} from "b";
          |export {c} from "c";
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

    // Using comments for grouping.
    {
      code: input`
          |export * from "g"
          |export * from "f";
          |// Group 2
          |export * from "e"
          |export * from "d"
          |/* Group 3 */
          |
          |export * from "c"
          |
          |
          |export * from "b"
          |
          |
          | /* Group 4
          | */
          |
          |   export * from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export * from "f";
          |export * from "g"
          |// Group 2
          |export * from "d"
          |export * from "e"
          |/* Group 3 */
          |
          |export * from "b"
          |export * from "c"
          |
          |
          | /* Group 4
          | */
          |
          |   export * from "a"
        `);
      },
      errors: 3,
    },

    // Sorting specifiers.
    // In `a as c`, the “c” is used since that’s the “stable” name, while the
    // internal `a` name can change at any time without affecting the module
    // interface. In other words, this is “backwards” compared to
    // `import {a as c} from "x"`.
    {
      code: `export { d, a as c, a as b2, b, a } from "specifiers"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b, a as b2, a as c, d } from "specifiers"`
        );
      },
      errors: 1,
    },
    {
      code: `export { d, a as c, a as b2, b, a, }; var d, a, b;`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { a,b, a as b2, a as c, d,  }; var d, a, b;`
        );
      },
      errors: 1,
    },

    // Comments on the same line as something else don’t count for grouping.
    {
      code: input`
          |export * from "g"
          |/* f1 */export * from "f"; // f2
          |export * from "e" /* d
          | */
          |export * from "d"
          |export * from "c" /*
          | b */ export * from "b"
          | /* a
          | */ export * from "a"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          | /* a
          | */ export * from "a"
          |/*
          | b */ export * from "b"
          |export * from "c" 
          |/* d
          | */
          |export * from "d"
          |export * from "e" 
          |/* f1 */export * from "f"; // f2
          |export * from "g"
        `);
      },
      errors: 1,
    },

    // Sorting with lots of comments.
    {
      code: input`
          |/*1*//*2*/export/*3*/*/*4*/as/*as*/foo/*foo1*//*foo2*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/
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
          |};
          |var e, d;
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |/*1*//*2*/export/*3*/*/*4*/as/*as*/foo/*foo1*//*foo2*/from/*6*/"specifiers-lots-of-comments"/*7*//*8*/
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
          |};
          |var e, d;
        `);
      },
      errors: 2,
    },

    // Collapse blank lines inside export statements.
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
          |    }, a = 1
          |export {options as options2, a as a2}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export const options = {
          |
          |    a: 1,
          |
          |    b: 2
          |    }, a = 1
          |export {a as a2,options as options2}
        `);
      },
      errors: 1,
    },

    // Preserve indentation (for `<script>` tags).
    {
      code: input`
          |  export {e} from "e"
          |  export {
          |    b4, b3,
          |    b2
          |  } from "b";
          |  /* a */ export {a} from "a"; export {c} from "c"
          |  
          |    export {d} from "d"
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |  /* a */ export {a} from "a"; 
          |  export {
          |    b2,
          |b3,
          |    b4  } from "b";
          |export {c} from "c"
          |    export {d} from "d"
          |  export {e} from "e"
        `);
      },
      errors: 1,
    },

    // Handling last semicolon.
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

    // Handling `as default` (issue #58).
    {
      code: `export { something, something as default } from './something'`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export { something as default,something } from './something'`
        );
      },
      errors: 1,
    },

    // Tricky `default` cases.
    {
      code: `export {default as default, default as def, default as fault} from "b"`,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(
          `export {default as def, default as default, default as fault} from "b"`
        );
      },
      errors: 1,
    },

    // Test messageId, lines and columns.
    {
      code: input`
          |// before
          |/* also
          |before */ export * from "b";
          |export * from "a"; /*a*/ /* comment
          |after */ // after
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |// before
          |/* also
          |before */ export * from "a"; /*a*/ 
          |export * from "b";/* comment
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

    // https://github.com/5monkeys/djedi-cms/blob/133a24a9ddcc0f133aaac6bd2f13db4d6dfe2dce/djedi-react/src/index.js
    {
      code: input`
          |export { default as djedi } from "./djedi";
          |export { default as Node, NodeContext } from "./Node";
          |export { default as ForceNodes } from "./ForceNodes";
          |export { default as md } from "dedent-js";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export { default as djedi } from "./djedi";
          |export { default as ForceNodes } from "./ForceNodes";
          |export { default as Node, NodeContext } from "./Node";
          |export { default as md } from "dedent-js";
        `);
      },
      errors: 1,
    },

    // https://gitlab.com/appsemble/appsemble/-/blob/247705f90c606741149fec53c6738cce28a386a7/packages/node-utils/src/index.ts
    {
      code: input`
          |export * from './logger';
          |export * from './AppsembleError';
          |export * from './basicAuth';
          |export * from './commandDirOptions';
          |export * from './getWorkspaces';
          |export * from './handleError';
          |export * from './interceptors';
          |export * from './loggerMiddleware';
          |export * from './readFileOrString';
          |export * from './fs';
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export * from './AppsembleError';
          |export * from './basicAuth';
          |export * from './commandDirOptions';
          |export * from './fs';
          |export * from './getWorkspaces';
          |export * from './handleError';
          |export * from './interceptors';
          |export * from './logger';
          |export * from './loggerMiddleware';
          |export * from './readFileOrString';
        `);
      },
      errors: 1,
    },

    // https://github.com/facebook/react/blob/4c7036e807fa18a3e21a5182983c7c0f05c5936e/packages/react-dom/src/client/ReactDOM.js#L193-L217
    {
      code: input`
          |var
          |  createPortal,
          |  batchedUpdates,
          |  flushSync,
          |  Internals,
          |  ReactVersion,
          |  findDOMNode,
          |  hydrate,
          |  render,
          |  unmountComponentAtNode,
          |  createRoot,
          |  createBlockingRoot,
          |  flushControlled,
          |  scheduleHydration,
          |  renderSubtreeIntoContainer,
          |  unstable_createPortal,
          |  createEventHandle
          |;
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
          |  // Todo: remove in React 18.
          |  unstable_createPortal,
          |  // enableCreateEventHandleAPI
          |  createEventHandle as unstable_createEventHandle,
          |};
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |var
          |  createPortal,
          |  batchedUpdates,
          |  flushSync,
          |  Internals,
          |  ReactVersion,
          |  findDOMNode,
          |  hydrate,
          |  render,
          |  unmountComponentAtNode,
          |  createRoot,
          |  createBlockingRoot,
          |  flushControlled,
          |  scheduleHydration,
          |  renderSubtreeIntoContainer,
          |  unstable_createPortal,
          |  createEventHandle
          |;
          |export {
          |  Internals as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
          |  createBlockingRoot,
          |  createPortal,
          |  // exposeConcurrentModeAPIs
          |  createRoot,
          |  // Disabled behind disableLegacyReactDOMAPIs
          |  findDOMNode,
          |  flushSync,
          |  hydrate,
          |  render,
          |  unmountComponentAtNode,
          |  batchedUpdates as unstable_batchedUpdates,
          |  // enableCreateEventHandleAPI
          |  createEventHandle as unstable_createEventHandle,
          |  // Disabled behind disableUnstableCreatePortal
          |  // Temporary alias since we already shipped React 16 RC with it.
          |  // Todo: remove in React 18.
          |  unstable_createPortal,
          |  flushControlled as unstable_flushControlled,
          |  // Disabled behind disableUnstableRenderSubtreeIntoContainer
          |  renderSubtreeIntoContainer as unstable_renderSubtreeIntoContainer,
          |  scheduleHydration as unstable_scheduleHydration,
          |  ReactVersion as version,
          |};
        `);
      },
      errors: 1,
    },

    // https://github.com/apollographql/apollo-client/blob/39942881567ff9825a0f17bbf114ec441590f8bb/src/core/index.ts#L1-L98
    {
      code: input`
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
        expect(actual).toMatchInlineSnapshot(`
          |/* Core */
          |
          |export {
          |  ApolloClient,
          |  ApolloClientOptions,
          |  DefaultOptions
          |} from '../ApolloClient';
          |export {
          |  FragmentMatcher as LocalStateFragmentMatcher,
          |  Resolver,
          |} from '../core/LocalState';
          |export { NetworkStatus } from '../core/networkStatus';
          |export {
          |  ApolloCurrentQueryResult,
          |  FetchMoreOptions,
          |  ObservableQuery,
          |  UpdateQueryOptions,
          |} from '../core/ObservableQuery';
          |export * from '../core/types';
          |export {
          |  ErrorPolicy,
          |  FetchMoreQueryOptions,
          |  FetchPolicy,
          |  MutationOptions,
          |  MutationUpdaterFn,
          |  QueryBaseOptions,
          |  QueryOptions,
          |  SubscribeToMoreOptions,
          |  SubscriptionOptions,
          |  WatchQueryFetchPolicy,
          |  WatchQueryOptions,
          |} from '../core/watchQueryOptions';
          |export { ApolloError,isApolloError } from '../errors/ApolloError';
          |
          |/* Cache */
          |
          |export * from '../cache';
          |
          |/* Link */
          |
          |export { ApolloLink } from '../link/core/ApolloLink';
          |export { concat } from '../link/core/concat';
          |export { empty } from '../link/core/empty';
          |export { execute } from '../link/core/execute';
          |export { from } from '../link/core/from';
          |export { split } from '../link/core/split';
          |export * from '../link/core/types';
          |export { checkFetcher } from '../link/http/checkFetcher';
          |export { createHttpLink } from '../link/http/createHttpLink';
          |export { createSignalIfSupported } from '../link/http/createSignalIfSupported';
          |export { HttpLink } from '../link/http/HttpLink';
          |export {
          |  parseAndCheckHttpResponse,
          |  ServerParseError
          |} from '../link/http/parseAndCheckHttpResponse';
          |export {
          |  fallbackHttpConfig,
          |  HttpOptions,
          |  selectHttpOptionsAndBody,
          |  UriFunction
          |} from '../link/http/selectHttpOptionsAndBody';
          |export { selectURI } from '../link/http/selectURI';
          |export {
          |  ClientParseError,
          |  serializeFetchParameter} from '../link/http/serializeFetchParameter';
          |export { fromError } from '../link/utils/fromError';
          |export { fromPromise } from '../link/utils/fromPromise';
          |export { ServerError, throwServerError } from '../link/utils/throwServerError';
          |export { toPromise } from '../link/utils/toPromise';
          |export {
          |  Observable,
          |  ObservableSubscription,
          |  Observer} from '../utilities/observables/Observable';
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
        `);
      },
      errors: 2,
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

    // type specifiers.
    `export { a, type b, c, type d } from "a"`,
    `export { a, type b, c, type d }`,

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
          |export {a, type type as type, z} from "../type";
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export type {Z} from "Z";
          |export type Y = 5;
          |export {a, type type as type, z} from "../type";
          |export type {B} from "./B";
          |export type {C} from "/B";
          |export type {E} from "@/B";
          |export type {X} from "X";
        `);
      },
      errors: 1,
    },

    // Exports inside module declarations.
    {
      code: input`
          |export type {X} from "X";
          |export type {B} from "./B";
          |
          |declare module 'my-module' {
          |  export type { PlatformPath, ParsedPath } from 'path';
          |  export { type CopyOptions } from 'fs'; interface Something {}
          |  export {a, type type as type, z} from "../type";
          |  // comment
          |    export * as d from "d"
          |export {c} from "c"; /*
          |  */\texport {} from "b"; // b
          |}
      `,
      output: (actual) => {
        expect(actual).toMatchInlineSnapshot(`
          |export type {B} from "./B";
          |export type {X} from "X";
          |
          |declare module 'my-module' {
          |  export { type CopyOptions } from 'fs'; 
          |  export type { ParsedPath,PlatformPath } from 'path';interface Something {}
          |  export {a, type type as type, z} from "../type";
          |  // comment
          |/*
          |  */→export {} from "b"; // b
          |export {c} from "c"; 
          |    export * as d from "d"
          |}
        `);
      },
      errors: 3,
    },
  ],
};

const javascriptRuleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
});

const flowRuleTester = new RuleTester({
  parser: require.resolve("@babel/eslint-parser"),
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
