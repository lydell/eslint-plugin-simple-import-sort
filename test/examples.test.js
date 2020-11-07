"use strict";

const path = require("path");

const spawn = require("cross-spawn");
const prettier = require("prettier");

// Make snapshots easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: (value) => typeof value === "string",
  print: (value) => value,
});

describe("examples", () => {
  const result = spawn.sync("npm", ["run", "eslint:examples", "--silent"], {
    encoding: "utf8",
  });

  const output = JSON.parse(result.stdout);

  for (const item of output) {
    const name = path.basename(item.filePath);
    if (!name.startsWith(".")) {
      test(`${name}`, () => {
        expect(item).toMatchObject({
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        });
        const code = name.includes("prettier")
          ? prettier.format(item.output, { parser: "babel" })
          : item.output;
        expect(code).toMatchSnapshot();
      });
    }
  }
});
