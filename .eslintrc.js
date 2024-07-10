"use strict";

const error = "error";
const warn = process.argv.includes("--report-unused-disable-directives")
  ? "error"
  : "warn";

module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:eslint-plugin/recommended"],
  plugins: ["vitest", "eslint-plugin"],
  parserOptions: {
    ecmaVersion: 2018,
  },
  env: { es6: true, node: true },
  rules: {
    "arrow-body-style": warn,
    "default-case": error,
    "default-case-last": warn,
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
    "no-shadow": error,
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
    "eslint-plugin/require-meta-docs-description": error,
    "eslint-plugin/require-meta-docs-url": error,
    "eslint-plugin/require-meta-schema": error,
  },
  overrides: [
    {
      files: ["test/*.js", "*.mjs"],
      parserOptions: {
        sourceType: "module",
      },
    },
    {
      files: ["*.test.js"],
      extends: ["plugin:vitest/recommended"],
      rules: {
        "vitest/no-disabled-tests": warn,
        "vitest/no-focused-tests": warn,
      },
    },
  ],
};
