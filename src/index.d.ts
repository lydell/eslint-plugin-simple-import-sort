import type { ESLint } from "eslint";

declare const eslintPluginSimpleImportSort: ESLint.Plugin & { defaultGroups: (string | string[])[] };

export = eslintPluginSimpleImportSort;
