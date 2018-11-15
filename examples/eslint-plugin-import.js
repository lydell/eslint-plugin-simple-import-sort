// This file uses rules from eslint-plugin-import
// (https://github.com/benmosher/eslint-plugin-import/) to hoist the imports to
// the top and add a blank line after them.
foo();
import b from "b";
import a from "a";
bar();
import "z";
