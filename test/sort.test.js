"use strict";

const { sortImportExportItems } = require("../src/shared");

const input = `
import '@scoped/package/a.css';
import { a } from '@scoped/package/b';
import '@scoped/package/c.css';
import 'package/d.css';
import { e } from 'package/e';
import 'package/f.css';
`
  .trim()
  .split("\n")
  .map((line, index) => {
    const source = /'([^']+)'/.exec(line)[1];
    return {
      isSideEffectImport: line.startsWith("import '"),
      source: {
        source,
        originalSource: source,
        kind: "value",
      },
      index,
      line,
    };
  });

const permutations = (items) =>
  items.length <= 1
    ? [items]
    : items.flatMap((first, index) =>
        permutations([
          ...items.slice(0, index),
          ...items.slice(index + 1),
        ]).map((rest) => [first, ...rest])
      );

const itemsToString = (items) => items.map((item) => item.line).join("\n");

const extractLinesSet = (items) => new Set(items.map((item) => item.line));

const extractSideEffects = (items) =>
  items.filter((item) => item.isSideEffectImport).map((item) => item.line);

const itemsList = permutations(input);

describe("side effect imports always stay in order", () => {
  const sortedVariations = new Set();

  for (const [index, items] of itemsList.entries()) {
    test(`Permutation index ${index}: ${itemsToString(items)}`, () => {
      const sorted = sortImportExportItems(items);

      // We still have the same imports, just in a different order.
      expect(sorted).toHaveLength(items.length);
      expect(extractLinesSet(sorted)).toStrictEqual(extractLinesSet(items));

      // All side effect imports are in the same order as before.
      expect(extractSideEffects(sorted)).toStrictEqual(
        extractSideEffects(items)
      );

      sortedVariations.add(itemsToString(sorted));
    });
  }

  test("other imports should be as sorted as possible", () => {
    expect(sortedVariations.size).toBe(138);
  });
});
