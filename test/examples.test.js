import { describe, expect, test } from "vitest";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { basename } from "path";
import { format } from "prettier";

// Make snapshots easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: (value) => typeof value === "string",
  print: (value) => value,
});

describe("examples", () => {
  const result = spawnSync("npm", ["run", "examples", "--silent"], {
    encoding: "utf8",
    shell: true, // For Windows.
  });

  const output = JSON.parse(result.stdout);

  for (const item of output) {
    const name = basename(item.filePath);
    if (!(name.startsWith(".") || name === "README.md")) {
      test(`${name}`, async () => {
        expect(item).toMatchObject({
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        });
        const code = name.includes("prettier")
          ? await format(item.output || readFileSync(item.filePath, "utf8"), {
              parser: "babel-ts",
            })
          : item.output;
        expect(code).toMatchSnapshot();
      });
    }
  }
});
