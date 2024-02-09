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
  // TypeScript import assignments.
  ["^\\u0001", "^\\u0002"],
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
    },
    messages: {
      sort: "Run autofix to sort these imports!",
    },
  },
  create: (context) => {
    const { groups: rawGroups = defaultGroups } = context.options[0] || {};

    const outerGroups = rawGroups.map((groups) =>
      groups.map((item) => RegExp(item, "u"))
    );

    const parents = new Set();

    return {
      ImportDeclaration: (node) => {
        parents.add(node.parent);
      },
      TSImportEqualsDeclaration: (node) => {
        let { parent } = node;
        while (parent && !["TSModuleBlock", "Program"].includes(parent.type)) {
          ({ parent } = parent);
        }
        parents.add(parent);
      },

      "Program:exit": () => {
        for (const parent of parents) {
          for (const chunk of shared.extractChunks(parent, (node) =>
            isImport(node) ? "PartOfChunk" : "NotPartOfChunk"
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
    isSideEffectImport,
    getSpecifiers
  );
  const sortedItems = makeSortedItems(items, outerGroups);
  const sorted = shared.printSortedItems(sortedItems, items, sourceCode);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  shared.maybeReportSorting(context, sorted, start, end);
}

function makeSortedItems(items, outerGroups) {
  const itemGroups = outerGroups.map((groups) =>
    groups.map((regex) => ({ regex, items: [] }))
  );
  const rest = [];

  for (const item of items) {
    const { originalSource } = item.source;
    const sourceWithControlCharacter = getSourceWithControlCharacter(
      originalSource,
      item
    );
    const [matchedGroup] = shared
      .flatMap(itemGroups, (groups) =>
        groups.map((group) => [
          group,
          group.regex.exec(sourceWithControlCharacter),
        ])
      )
      .reduce(
        ([group, longestMatch], [nextGroup, nextMatch]) =>
          nextMatch != null &&
          (longestMatch == null || nextMatch[0].length > longestMatch[0].length)
            ? [nextGroup, nextMatch]
            : [group, longestMatch],
        [undefined, undefined]
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
      groups.map((group) => shared.sortImportExportItems(group.items))
    );
}

function getSourceWithControlCharacter(originalSource, item) {
  if (item.isSideEffectImport) {
    return `\0${originalSource}`;
  }
  switch (item.source.kind) {
    case shared.KIND_VALUE:
      return originalSource;
    case shared.KIND_TS_IMPORT_ASSIGNMENT_REQUIRE:
      return `\u0001${originalSource}`;
    case shared.KIND_TS_IMPORT_ASSIGNMENT_NAMESPACE:
      return `\u0002${originalSource}`;
    default: // `type` and `typeof`.
      return `${originalSource}\u0000`;
  }
}

// Exclude "ImportDefaultSpecifier" – the "def" in `import def, {a, b}`.
function getSpecifiers(importNode) {
  switch (importNode.type) {
    case "ImportDeclaration":
      return importNode.specifiers.filter((node) => isImportSpecifier(node));
    case "ExportNamedDeclaration":
    case "TSImportEqualsDeclaration":
      return [];
    // istanbul ignore next
    default:
      throw new Error(`Unsupported import node type: ${importNode.type}`);
  }
}

// Full import statement.
function isImport(node) {
  return (
    node.type === "ImportDeclaration" ||
    node.type === "TSImportEqualsDeclaration" ||
    (node.type === "ExportNamedDeclaration" &&
      node.declaration &&
      node.declaration.type === "TSImportEqualsDeclaration")
  );
}

// import def, { a, b as c, type d } from "A"
//               ^  ^^^^^^  ^^^^^^
function isImportSpecifier(node) {
  return node.type === "ImportSpecifier";
}

// import "setup"
// But not: import {} from "setup"
// And not: import type {} from "setup"
function isSideEffectImport(importNode, sourceCode) {
  switch (importNode.type) {
    case "ImportDeclaration":
      return (
        importNode.specifiers.length === 0 &&
        (!importNode.importKind ||
          importNode.importKind === shared.KIND_VALUE) &&
        !shared.isPunctuator(
          sourceCode.getFirstToken(importNode, { skip: 1 }),
          "{"
        )
      );
    case "ExportNamedDeclaration":
    case "TSImportEqualsDeclaration":
      return false;
    // istanbul ignore next
    default:
      throw new Error(`Unsupported import node type: ${importNode.type}`);
  }
}
