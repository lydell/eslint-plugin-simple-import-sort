"use strict";

const importsRule = require("./imports");
const exportsRule = require("./exports");

module.exports = {
  rules: {
    imports: importsRule,
    exports: exportsRule,
  },
};
