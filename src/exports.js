"use strict";

const shared = require("./shared");

module.exports = {
  meta: {
    type: "layout",
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          caseSensitive: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    docs: {
      url: "https://github.com/lydell/eslint-plugin-simple-import-sort#sort-order",
      description: "Automatically sort exports.",
    },
    messages: {
      sort: "Run autofix to sort these exports!",
    },
  },
  create: (context) => {
    const { caseSensitive = false } = context.options[0] || {};

    const parents = new Set();

    const addParent = (node) => {
      if (isExportFrom(node)) {
        parents.add(node.parent);
      }
    };

    return {
      ExportNamedDeclaration: (node) => {
        if (node.source == null && node.declaration == null) {
          maybeReportExportSpecifierSorting(node, context, caseSensitive);
        } else {
          addParent(node);
        }
      },

      ExportAllDeclaration: addParent,

      "Program:exit": () => {
        const sourceCode = shared.getSourceCode(context);
        for (const parent of parents) {
          for (const chunk of shared.extractChunks(parent, (node, lastNode) =>
            isPartOfChunk(node, lastNode, sourceCode),
          )) {
            maybeReportChunkSorting(chunk, context, caseSensitive);
          }
        }
        parents.clear();
      },
    };
  },
};

function maybeReportChunkSorting(chunk, context, caseSensitive) {
  const sourceCode = shared.getSourceCode(context);
  const items = shared.getImportExportItems(
    chunk,
    sourceCode,
    () => 1, // getStyle
    getSpecifiers,
    caseSensitive,
  );
  const sortedItems = [[shared.sortImportExportItems(items, caseSensitive)]];
  const sorted = shared.printSortedItems(sortedItems, items, sourceCode);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  shared.maybeReportSorting(context, sorted, start, end);
}

function maybeReportExportSpecifierSorting(node, context, caseSensitive) {
  const sorted = shared.printWithSortedSpecifiers(
    node,
    shared.getSourceCode(context),
    getSpecifiers,
    caseSensitive,
  );
  const [start, end] = node.range;
  shared.maybeReportSorting(context, sorted, start, end);
}

// `export * from "a"` does not have `.specifiers`.
function getSpecifiers(exportNode) {
  return exportNode.specifiers || [];
}

function isPartOfChunk(node, lastNode, sourceCode) {
  if (!isExportFrom(node)) {
    return "NotPartOfChunk";
  }

  const hasGroupingComment = sourceCode
    .getCommentsBefore(node)
    .some(
      (comment) =>
        (lastNode == null || comment.loc.start.line > lastNode.loc.end.line) &&
        comment.loc.end.line < node.loc.start.line,
    );

  return hasGroupingComment ? "PartOfNewChunk" : "PartOfChunk";
}

// Full export-from statement.
// export {a, b} from "A"
// export * from "A"
// export * as A from "A"
function isExportFrom(node) {
  return (
    (node.type === "ExportNamedDeclaration" ||
      node.type === "ExportAllDeclaration") &&
    node.source != null
  );
}
