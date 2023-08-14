"use strict";

const importsRule = require("./imports");
const exportsRule = require("./exports");

module.exports = {
  configs: {
    recommended: {
      parserOptions: {
        sourceType: "module",
      },
      plugins: ["simple-import-sort"],
      rules: {
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
      },
    },
  },
  rules: {
    imports: importsRule,
    exports: exportsRule,
  },
};
