"use strict";

const { extractChunks } = require("./shared");

module.exports = {
  meta: {
    type: "layout",
    fixable: "code",
    schema: [],
    docs: {
      url:
        "https://github.com/lydell/eslint-plugin-simple-import-sort#sort-order",
    },
    messages: {
      sort: "Run autofix to sort these exports!",
    },
  },
  create: (context) => ({
    Program: (node) => {
      for (const exports of extractChunks(node, isExportFrom)) {
        maybeReportChunkSorting(exports, context);
      }
    },
    ExportNamedDeclaration: (node) => {
      if (node.source == null && node.declaration == null) {
        maybeReportExportSpecifierSorting(node, context);
      }
    },
  }),
};

function maybeReportChunkSorting(chunk, context, outerGroups) {
  const sourceCode = context.getSourceCode();
  const items = getImportExportItems(chunk, sourceCode);
  const sorted = printSortedImportsOrExports(items, sourceCode, outerGroups);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  maybeReportSorting(context, sorted, start, end);
}

function maybeReportExportSpecifierSorting(node, context) {
  const sorted = printWithSortedSpecifiers(node, context.getSourceCode());
  const [start, end] = node.range;
  maybeReportSorting(context, sorted, start, end);
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
