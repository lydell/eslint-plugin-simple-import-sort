"use strict";

const sort = require("./sort");

module.exports = {
  rules: {
    sort,
  },
  configs: {
    recommended: {
      plugins: ["simple-import-sort"],
      rules: {
        "simple-import-sort/sort": "error",
        "sort-imports": "off",
      },
    },
  },
};
