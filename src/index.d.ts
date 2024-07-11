import type { ESLint } from "eslint";

declare const eslintPluginSimpleImportSort: ESLint.Plugin;

export = eslintPluginSimpleImportSort;

declare module "eslint-define-config" {
  export interface CustomRuleOptions {
    /**
     * Automatically sort imports.
     *
     * @see [imports](https://github.com/lydell/eslint-plugin-simple-import-sort/blob/main/docs/rules/imports.md)
     */
    "simple-import-sort/imports": [
      {
        groups?: (RegExp | string)[][];
      },
    ];

    /**
     * Automatically sort exports.
     *
     * @see [exports](https://github.com/lydell/eslint-plugin-simple-import-sort/blob/main/docs/rules/exports.md)
     */
    "simple-import-sort/exports": [];
  }
}
