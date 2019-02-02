// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";
import fs from "fs";

// Absolute imports, full URLs and other imports.
import b from "https://example.com/script.js";
import c from "/";
import d from "/home/user/foo";
import Error from "@/components/error.vue"

// Relative imports.
import e from "../../utils";
import f from "../..";
import type { B } from "../types";
import typeof C from "../types";
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
} from ".";
