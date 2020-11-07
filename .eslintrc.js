"use strict";

const error = "error";
const warn = process.argv.includes("--report-unused-disable-directives")
  ? "error"
  : "warn";

module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  plugins: ["jest"],
  parserOptions: {
    ecmaVersion: 2018,
  },
  env: { es6: true, node: true },
  rules: {
    "arrow-body-style": warn,
    "dot-notation": warn,
    "no-caller": error,
    "no-console": warn,
    "no-eval": error,
    "no-labels": error,
    "no-octal-escape": error,
    "no-param-reassign": error,
    "no-promise-executor-return": error,
    "no-restricted-syntax": [
      error,
      {
        selector: "SequenceExpression",
        message:
          "The comma operator is confusing and a common mistake. Don’t use it!",
      },
    ],
    "no-self-compare": error,
    "no-shadow": "error",
    "no-template-curly-in-string": error,
    "no-unmodified-loop-condition": error,
    "no-unneeded-ternary": warn,
    "no-useless-backreference": error,
    "no-useless-computed-key": warn,
    "no-useless-concat": warn,
    "no-useless-constructor": warn,
    "no-useless-rename": warn,
    "no-var": warn,
    "object-shorthand": warn,
    "one-var": [warn, "never"],
    "prefer-arrow-callback": warn,
    "prefer-const": warn,
    "prefer-destructuring": [warn, { object: true, array: false }],
    "prefer-exponentiation-operator": warn,
    "prefer-numeric-literals": warn,
    "prefer-object-spread": warn,
    "prefer-promise-reject-errors": error,
    "prefer-regex-literals": warn,
    "prefer-rest-params": warn,
    "prefer-spread": warn,
    "prefer-template": warn,
    curly: warn,
    eqeqeq: [error, "always", { null: "ignore" }],
    strict: error,
    yoda: warn,
  },
  overrides: [
    {
      files: ["*.test.js"],
      extends: ["plugin:jest/recommended"],
      env: { "jest/globals": true },
    },
  ],
};
