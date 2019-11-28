"use strict";

const sort = require("./sort");

module.exports = {
  rules: {
    sort,
  },
  configs: {
    sort: {
      plugins: ["simple-import-sort"],
      rules: {
        "simple-import-sort/sort": "error",
      },
    },
  },
};
