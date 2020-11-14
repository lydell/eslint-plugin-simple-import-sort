"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const prettier = require("prettier");

// Make snapshots easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: (value) => typeof value === "string",
  print: (value) => value,
});

describe("examples", () => {
  const result = childProcess.spawnSync(
    "npm",
    ["run", "examples", "--silent"],
    {
      encoding: "utf8",
      shell: true, // For Windows.
    }
  );

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
          ? prettier.format(
              item.output || fs.readFileSync(item.filePath, "utf8"),
              { parser: "babel" }
            )
          : item.output;
        expect(code).toMatchSnapshot();
      });
    }
  }
});
