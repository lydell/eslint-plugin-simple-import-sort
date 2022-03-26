"use strict";

function setup(expect) {
  const assert = require("assert");

  // Hack to allow using `.toMatchInlineSnapshot` for `output` in `RuleTester`.
  // https://github.com/eslint/eslint/blob/7621f5d2aa7d87e798b75ca47d6889c280597e99/lib/rule-tester/rule-tester.js#L614
  const originalStrictEqual = assert.strictEqual;
  assert.strictEqual = (actual, expected, message) => {
    if (message === "Output is incorrect." && typeof expected === "function") {
      // Make tabs and carriage returns visible.
      const replaced = actual.replace(/\t/g, "→").replace(/\r/g, "<CR>");
      // Add pipes at the beginning of lines to make snapshots easier to read when
      // lines start with whitespace.
      const piped = replaced.includes("\n")
        ? `|${replaced}`.replace(/\n/g, "\n|")
        : replaced;
      expected(piped);
    } else {
      originalStrictEqual(actual, expected, message);
    }
  };

  // Make snapshots easier to read.
  // Before: `"\\"string\\""`
  // After: `"string"`
  expect.addSnapshotSerializer({
    test: (value) => typeof value === "string",
    print: (value) => value,
  });

  return expect2(expect);
}

// Make multiline inputs easier to read. Every line must start with 10 spaces
// and a pipe. The spaces and the pipe are stripped away. This allows indenting
// the string, even when lines start with whitespace.
// Additionally, the string must start with a newline (with no spaces before
// it), and end with a newline (optionally followed by spaces).
function input(strings) {
  if (strings.length !== 1) {
    const loc = getLoc();
    throw new Error(
      `input: ${loc} Expected no interpolations, but got ${strings.length} separate parts.`
    );
  }

  const string = strings[0];

  if (!/^(?:\n {10}\|[^\n]*)+\n[^\S\n]*$/.test(string)) {
    const loc = getLoc();
    throw new Error(
      `input: ${loc} Every line must start with 10 spaces and a \`|\`.`
    );
  }

  return strip(string);
}

function strip(string, { keepPipes = false } = {}) {
  return (
    string
      // Remove indentation and pipes. (The pipes need to be kept in the `.toBe`
      // checks.)
      .replace(/\n *\|/g, keepPipes ? "\n|" : "\n")
      // Remove starting and ending newline (and optional spaces).
      .replace(/^\n|\n[^\S\n]*$/g, "")
  );
}

function getLoc(depth = 1) {
  const line = new Error().stack.split("\n")[depth + 2];
  const match = /\d+:\d+/.exec(line || "");
  return match != null ? match[0] : "?";
}

// Run `baseTests` with all parsers, but only use `.toMatchInlineSnapshot` with
// the first one, because Jest can’t update the snapshots otherwise.
const expect2 =
  (expect) =>
  (...args) => {
    const ret = expect(...args);
    ret.toMatchInlineSnapshot = (string = "No snapshot yet – run again!") =>
      ret.toBe(strip(string, { keepPipes: true }));
    return ret;
  };

module.exports = {
  input,
  setup,
};
