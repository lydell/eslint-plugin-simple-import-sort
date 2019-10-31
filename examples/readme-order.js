// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Node.js builtins.
import fs from "fs";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";

// Absolute imports, full URLs and other imports.
import b from "https://example.com/script.js";
import Error from "@/components/error.vue";
import c from "/";
import d from "/home/user/foo";

// Relative imports.
import e from "../..";
import f from "../../Utils"; // Case insensitive.
import type { B } from "../types";
import typeof C from "../types";
import g from ".";
import h from "./constants";
import i from "./styles";
import j from "html-loader!./text.html";

// Regardless of group, imported items are sorted like this:
import {
  // First, Flow type imports.
  type x,
  typeof y,
  // Then everything else, alphabetically:
  k,
  L, // Case insensitive.
  m as anotherName, // Sorted by the original name “m”, not “anotherName”.
  m as tie, // But do use the `as` name in case of a tie.
  n,
  // Numbers are sorted by their numeric value:
  img1,
  img2,
  img10,
} from "./x";
