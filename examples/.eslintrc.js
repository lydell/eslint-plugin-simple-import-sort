"use strict";

// Open `test/__snapshots__/examples.test.js.snap` to see what the files here in
// `example/` look like after running `eslint --fix`. Each file has slightly
// different configuration – see below.

module.exports = {
  root: true,
  parserOptions: {
    sourceType: "module",
  },
  env: { es6: true },
  rules: {
    // The actual rule name is "simple-import-sort/sort", but for technical
    // reasons it’s just called "sort" within the examples of this repo.
    // "simple-import-sort/sort": "error",
    sort: "error",
  },
  overrides: [
    {
      // This file only enables the “sort” rule from this plugin. After
      // autofixing, there might be some oddly placed spaces.
      files: ["1.spaces.just-sort.js"],
    },
    {
      // You can enable some builtin rules to fix up the spaces after sorting.
      files: ["2.spaces.eslint-builtin.js"],
      rules: {
        "comma-spacing": "error",
        indent: "error",
        "object-curly-spacing": "error",
        // There might be more rules you want to enable. See:
        // https://eslint.org/docs/rules/
      },
    },
    {
      // Alternatively, use Prettier (https://prettier.io/) to fix formatting.
      // This is the much easier and recommended approach.
      files: ["3.spaces.prettier.js"],
      plugins: ["prettier"],
      rules: {
        "prettier/prettier": "error",
      },
    },
    {
      files: ["absolute-prefix.js"],
      rules: {
        sort: [
          "error",
          {
            absolutePrefixes: ["/", "@/"],
          },
        ],
      },
    },
    {
      // Use these rules from eslint-plugin-import
      // (https://github.com/benmosher/eslint-plugin-import/) if you want hoist
      // imports to the top and add a blank line after them.
      files: ["eslint-plugin-import.js"],
      plugins: ["import"],
      rules: {
        "import/first": "error",
        "import/newline-after-import": "error",
      },
    },
    {
      // ignore.js shows how to ignore sorting and errors when needed.
      files: ["ignore.js"],
      plugins: ["import"],
      rules: {
        "no-duplicate-imports": "error",
        "import/no-duplicates": "error",
      },
    },
    {
      // These files are used in README.md.
      files: ["readme-*.js"],
      parser: "babel-eslint",
      plugins: ["prettier"],
      rules: {
        "prettier/prettier": "error",
      },
    },
    {
      // These files are used in README.md.
      files: ["readme-comments*.js"],
      rules: {
        "prettier/prettier": "off",
      },
    },
    {
      // TypeScript.
      files: ["*.ts"],
      parser: "@typescript-eslint/parser",
    },
  ],
};
