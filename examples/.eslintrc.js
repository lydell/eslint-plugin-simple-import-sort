"use strict";

// Open `test/__snapshots__/examples.test.js.snap` to see what the files here in
// `example/` look like after running `eslint --fix`. Each file has slightly
// different configuration – see below.

const vue = require("eslint-plugin-vue");

module.exports = {
  root: true,
  parserOptions: {
    sourceType: "module",
  },
  env: { es6: true },
  rules: {
    // The actual rule names are "simple-import-sort/imports" and
    // "simple-import-sort/exports", but for technical reasons they’re called
    // just "imports" and "exports" within the examples of this repo.
    // "simple-import-sort/imports": "error",
    // "simple-import-sort/exports": "error",
    imports: "error",
    exports: "error",
  },
  overrides: [
    {
      // This file only enables the “imports” rule from this plugin. After
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
      // This doesn’t need any extra ESLint config, only Prettier setup.
    },
    {
      // Use these rules from eslint-plugin-import
      // (https://github.com/benmosher/eslint-plugin-import/) if you want hoist
      // imports to the top, add a blank line after them and merge duplicates.
      files: ["eslint-plugin-import.js"],
      plugins: ["import"],
      rules: {
        "import/first": "error",
        "import/newline-after-import": "error",
        "import/no-duplicates": "error",
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
      files: ["groups.custom.js"],
      rules: {
        imports: [
          "error",
          {
            groups: [
              // Node.js builtins. You could also generate this regex if you use a `.js` config.
              // For example: `^(${require("module").builtinModules.join("|")})(/|$)`
              [
                "^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process|async_hooks|http2|perf_hooks)(/.*|$)",
              ],
              // Packages. `react` related packages come first.
              ["^react", "^@?\\w"],
              // Internal packages.
              ["^(@|@company|@ui|components|utils|config|vendored-lib)(/.*|$)"],
              // Side effect imports.
              ["^\\u0000"],
              // Parent imports. Put `..` last.
              ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
              // Other relative imports. Put same-folder imports and `.` last.
              ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
              // Style imports.
              ["^.+\\.s?css$"],
            ],
          },
        ],
      },
    },
    {
      files: ["groups.no-blank-lines.js"],
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with no blank lines.
            groups: [["^\\u0000", "^@?\\w", "^", "^\\."]],
          },
        ],
      },
    },
    {
      files: ["groups.default-reverse.js"],
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but in reverse.
            groups: [["^\\."], ["^"], ["^@?\\w"], ["^\\u0000"]],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-first.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports first as a separate group.
            groups: [["\u0000$"], ["^\\u0000"], ["^@?\\w"], ["^"], ["^\\."]],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-last.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports last as a separate group.
            groups: [["^\\u0000"], ["^@?\\w"], ["^"], ["^\\."], ["^.+\u0000$"]],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-first-sorted.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports first as a separate
            // group, sorting that group like non-type imports are grouped.
            groups: [
              ["^@?\\w.*\\u0000$", "\\u0000$", "^\\..*\\u0000$"],
              ["^\\u0000"],
              ["^@?\\w"],
              ["^"],
              ["^\\."],
            ],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-last-sorted.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports last as a separate
            // group, sorting that group like non-type imports are grouped.
            groups: [
              ["^\\u0000"],
              ["^@?\\w"],
              ["^"],
              ["^\\."],
              ["^@?\\w.*\\u0000$", "^[^.].*\\u0000$", "^\\..*\\u0000$"],
            ],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-first-in-each-group.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports first in each group.
            groups: [
              ["^\\u0000"],
              ["^@?\\w.*\\u0000$", "^@?\\w"],
              ["(?<=\\u0000)$", "^"],
              ["^\\..*\\u0000$", "^\\."],
            ],
          },
        ],
      },
    },
    {
      files: ["groups.type-imports-last-in-each-group.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        imports: [
          "error",
          {
            // The default grouping, but with type imports last in each group.
            groups: [
              ["^\\u0000"],
              ["^@?\\w", "^@?\\w.*\\u0000$"],
              ["(?<!\\u0000)$", "(?<=\\u0000)$"],
              ["^\\.", "^\\..*\\u0000$"],
            ],
          },
        ],
      },
    },
    {
      files: ["groups.none.js"],
      rules: {
        imports: [
          "error",
          {
            // No grouping, only alphabetical sorting.
            groups: [],
          },
        ],
      },
    },
    {
      // These files are used in README.md.
      files: ["readme-*.js"],
      parser: "babel-eslint",
    },
    {
      // TypeScript.
      files: ["*.ts"],
      parser: "@typescript-eslint/parser",
    },
    {
      // Vue `<script>` tags.
      files: ["*.vue"],
      parser: vue.configs.base.parser,
      plugins: ["vue"],
    },
    {
      // Markdown JS code blocks.
      files: ["*.md"],
      plugins: ["markdown"],
    },
  ],
};
