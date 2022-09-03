// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Node.js builtins prefixed with `node:`.
import * as fs from "node:fs";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";
import fs2 from "fs";
import b from "https://example.com/script.js";

// Absolute imports and other imports.
import c from "/";
import d from "/home/user/foo";
import Error from "@/components/error.vue";

// Relative imports.
import e from "../..";
import type { B } from "../types";
import typeof C from "../types";
import f from "../Utils"; // Case insensitive.
import g from ".";
import h from "./constants";
import i from "./styles";

// Different types of exports:
export { a } from "../..";
export { b } from "/";
export { Error } from "@/components/error.vue";
export * from "an-npm-package";
export { readFile } from "fs";
export * as ns from "https://example.com/script.js";

// This comment groups some more exports:
export { e } from "../..";
export { f } from "../Utils";
export { g } from ".";
export { h } from "./constants";
export { i } from "./styles";

// Other exports – the plugin does not touch these, other than sorting named
// exports inside braces.
export var one = 1;
export let two = 2;
export const three = 3;
export function func() {}
export class Class {}
export type Type = string;
export { named, other as renamed };
export type { T, U as V };
export default whatever;

var named, other;
type T = 1;
type U = 1;
