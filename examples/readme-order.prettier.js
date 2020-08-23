// Side effect imports. (These are not sorted internally.)
import "./setup";
import "some-polyfill";
import "./global.css";

// Packages.
import type A from "an-npm-package";
import a from "an-npm-package";
import fs from "fs";
import b from "https://example.com/script.js";

// Absolute imports and other imports.
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

// Package re-exports.
export * from "an-npm-package";
export { readFile } from "fs";
export * as ns from "https://example.com/script.js";

// Absolute and other re-exports.
export { Error } from "@/components/error.vue";
export { c } from "/";
export { d } from "/home/user/foo";

// Relative re-exports.
export { e } from "../..";
export { f } from "../../Utils"; // Case insensitive.
export { g } from ".";
export { h } from "./constants";
export { i } from "./styles";

// Other exports. (These are not sorted internally.)
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
