// Flow type imports.
import type A from "A";
import type { C } from "./types";
import typeof B from "B";

// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Packages and full URLs.
import a from "an-npm-package";
import b from "https://example.com/script.js";

// Absolute imports.
import c from "/";
import d from "/home/user/foo";

// Relative imports.
import e from "../../utils";
import f from "../..";
import g from "./constants";
import h from "./styles";
import i from "html-loader!./text.html";
import j from ".";

// Regardless of group, imported items are sorted like this:
import {
  // First, Flow type imports.
  type x,
  typeof y,
  // Then everything else, alphabetically:
  k,
  l,
  m as anotherName, // Sorted by the original name “m”, not “anotherName”.
  n,
} from "wherever";
