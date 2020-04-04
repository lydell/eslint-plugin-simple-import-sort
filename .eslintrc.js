"use strict";

const baseRules = require("eslint-config-lydell");

module.exports = {
  root: true,
  plugins: ["import", "jest"],
  env: { es6: true, node: true },
  rules: Object.assign({}, baseRules({ import: true }), {
    "import/order": ["error", { "newlines-between": "always" }],
    "no-console": "error",
    "prefer-template": "off",
  }),
  overrides: [
    {
      files: ["*.test.js"],
      env: { jest: true },
      rules: baseRules({ builtin: false, jest: true }),
    },
  ],
};
