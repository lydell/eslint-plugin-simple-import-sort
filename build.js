"use strict";

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const SRC = "src";
const BUILD = path.join(DIR, "build");

const READ_MORE =
  "**[➡️ Full readme](https://github.com/lydell/eslint-plugin-simple-import-sort/)**";

const FILES_TO_COPY = [
  { src: "LICENSE" },
  { src: "package-real.json", dest: "package.json" },
  {
    src: "README.md",
    transform: (content) => content.replace(/<!--[^]*$/, READ_MORE),
  },
  ...fs
    .readdirSync(SRC)
    .map((file) => ({ src: path.join(SRC, file), dest: file })),
];

fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD);

for (const { src, dest = src, transform } of FILES_TO_COPY) {
  if (transform) {
    fs.writeFileSync(
      path.join(BUILD, dest),
      transform(fs.readFileSync(path.join(DIR, src), "utf8"))
    );
  } else {
    fs.copyFileSync(path.join(DIR, src), path.join(BUILD, dest));
  }
}
