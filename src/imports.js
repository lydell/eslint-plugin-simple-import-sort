"use strict";

const shared = require("./shared");

const defaultGroups = [
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

module.exports = {
  meta: {
    type: "layout",
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          groups: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
        additionalProperties: false,
      },
    ],
    docs: {
      url: "https://github.com/lydell/eslint-plugin-simple-import-sort#sort-order",
      description: "Automatically sort imports.",
    },
    messages: {
      sort: "Run autofix to sort these imports!",
    },
  },
  create: (context) => {
    const { groups: rawGroups = defaultGroups } = context.options[0] || {};

    const outerGroups = rawGroups.map((groups) =>
      groups.map((item) => RegExp(item, "u")),
    );

    const parents = new Set();

    return {
      ImportDeclaration: (node) => {
        parents.add(node.parent);
      },

      "Program:exit": () => {
        for (const parent of parents) {
          for (const chunk of shared.extractChunks(parent, (node) =>
            isImport(node) ? "PartOfChunk" : "NotPartOfChunk",
          )) {
            maybeReportChunkSorting(chunk, context, outerGroups);
          }
        }
        parents.clear();
      },
    };
  },
};

function maybeReportChunkSorting(chunk, context, outerGroups) {
  const sourceCode = shared.getSourceCode(context);
  const items = shared.getImportExportItems(
    chunk,
    sourceCode,
    getStyle,
    getSpecifiers,
  );
  const sortedItems = makeSortedItems(items, outerGroups);
  const sorted = shared.printSortedItems(sortedItems, items, sourceCode);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  shared.maybeReportSorting(context, sorted, start, end);
}

function makeSortedItems(items, outerGroups) {
  const itemGroups = outerGroups.map((groups) =>
    groups.map((regex) => ({ regex, items: [] })),
  );
  const rest = [];

  for (const item of items) {
    const { originalSource } = item.source;
    const source =
      item.style === shared.SideEffectImport
        ? `\0${originalSource}`
        : item.source.kind !== "value"
          ? `${originalSource}\0`
          : originalSource;
    const [matchedGroup] = shared
      .flatMap(itemGroups, (groups) =>
        groups.map((group) => [group, group.regex.exec(source)]),
      )
      .reduce(
        ([group, longestMatch], [nextGroup, nextMatch]) =>
          nextMatch != null &&
          (longestMatch == null || nextMatch[0].length > longestMatch[0].length)
            ? [nextGroup, nextMatch]
            : [group, longestMatch],
        [undefined, undefined],
      );
    if (matchedGroup == null) {
      rest.push(item);
    } else {
      matchedGroup.items.push(item);
    }
  }

  return itemGroups
    .concat([[{ regex: /^/, items: rest }]])
    .map((groups) => groups.filter((group) => group.items.length > 0))
    .filter((groups) => groups.length > 0)
    .map((groups) =>
      groups.map((group) => shared.sortImportExportItems(group.items)),
    );
}

// Exclude "ImportDefaultSpecifier" – the "def" in `import def, {a, b}`.
function getSpecifiers(importNode) {
  return importNode.specifiers.filter((node) => isImportSpecifier(node));
}

// Full import statement.
function isImport(node) {
  return node.type === "ImportDeclaration";
}

// import def, { a, b as c, type d } from "A"
//               ^  ^^^^^^  ^^^^^^
function isImportSpecifier(node) {
  return node.type === "ImportSpecifier";
}

// Returns a number representing the import style for deterministic ordering.
// Order: side-effect (0) < namespace (1) < default (2) < named-only (3)
//
// Note: There are two primary use cases to keep in mind for deterministic ordering.
//
// The first use case is mixing a namespace import with importing a few things separately:
//
//     import * as Mod from "mod"
//     import Thing, { Other, type Mod } from "mod"
//
// It makes sense to have the namespace import first, since that feels like the “main” import.
//
// The second use case is type imports.
//
// The following is not allowed by TypeScript:
//
//     import type Def, {A, B} from "A"
//
// "A type-only import can specify a default import or named bindings, but not both."
// It must be split into two imports:
//
//     import type Def from "A"
//     import type {A, B} from "A"
//     // Or, depending on what you meant:
//     import {A, B} from "A"
//
// It makes sense to have the default import first, since a default import has to be first
// in a regular import statement with both a default import and named imports.
function getStyle(importNode, sourceCode) {
  if (importNode.specifiers.length === 0) {
    if (
      shared.isPunctuator(
        sourceCode.getFirstToken(importNode, {
          skip: importNode.importKind === "type" ? 2 : 1,
        }),
        "{",
      )
    ) {
      // `import {} from "A"` or `import type {} from "A"`
      // This counts as named-only (with 0 named items).
      return 3;
    }

    // `import "A"`
    // Note that `import type "A"` is _not_ a type import:
    // It is a default import creating a variable called `type`.
    return shared.SideEffectImport;
  }

  const [firstSpecifier] = importNode.specifiers;

  return firstSpecifier.type === "ImportNamespaceSpecifier"
    ? // `import * as x from "A"`
      1
    : firstSpecifier.type === "ImportDefaultSpecifier"
      ? // `import x from "A"` or `import x, { y } from "A"`
        2
      : // `import { x } from "A"`
        3;
}
