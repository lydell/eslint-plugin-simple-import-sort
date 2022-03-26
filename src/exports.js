"use strict";

const shared = require("./shared");

module.exports = {
  meta: {
    type: "layout",
    fixable: "code",
    schema: [],
    docs: {
      url: "https://github.com/lydell/eslint-plugin-simple-import-sort#sort-order",
    },
    messages: {
      sort: "Run autofix to sort these exports!",
    },
  },
  create: (context) => ({
    Program: (programNode) => {
      const sourceCode = context.getSourceCode();
      for (const chunk of shared.extractChunks(programNode, (node, lastNode) =>
        isPartOfChunk(node, lastNode, sourceCode)
      )) {
        maybeReportChunkSorting(chunk, context);
      }
    },
    ExportNamedDeclaration: (node) => {
      if (node.source == null && node.declaration == null) {
        maybeReportExportSpecifierSorting(node, context);
      }
    },
  }),
};

function maybeReportChunkSorting(chunk, context) {
  const sourceCode = context.getSourceCode();
  const items = shared.getImportExportItems(
    chunk,
    sourceCode,
    () => false, // isSideEffectImport
    getSpecifiers
  );
  const sortedItems = [[shared.sortImportExportItems(items)]];
  const sorted = shared.printSortedItems(sortedItems, items, sourceCode);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  shared.maybeReportSorting(context, sorted, start, end);
}

function maybeReportExportSpecifierSorting(node, context) {
  const sorted = shared.printWithSortedSpecifiers(
    node,
    context.getSourceCode(),
    getSpecifiers
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
        comment.loc.end.line < node.loc.start.line
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
