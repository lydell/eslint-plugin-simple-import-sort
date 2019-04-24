// This file uses rules from eslint-plugin-import
// (https://github.com/benmosher/eslint-plugin-import/) if you want hoist
// imports to the top, add a blank line after them and merge duplicates.
foo();
import b, {b1, b3} from "b";
import a from "a";
import {b2} from "b";
bar();
import "z";
