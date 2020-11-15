// First off, imports that are only used for side effects stay in the input
// order. These won’t be sorted:
import "b";
import "a";

// Just to separate the chunks of imports for this example. Move along.
separator();

// You can also disable sorting for a whole chunk. The actual rule name is
// "simple-import-sort/imports", but for technical reasons it’s just called
// "imports" within the examples of this repo.
// For copying: eslint-disable-next-line simple-import-sort/imports
// eslint-disable-next-line imports
import d from "d";
import c from "c";

// Note that putting a `eslint-disable-next-line simple-import-sort/imports`
// comment in the middle of a chunk of imports WON’T WORK. It HAS to be at the
// very start!

separator();

// If you lant to both import something from a module _and_ import it for its
// side effects _and_ you need it to run before other things, but don’t want to
// disable sorting altogether, there’s a workaround. Import it twice – once for
// side effects, once for the thing you want to import from it. You might need
// to disable some “no duplicate imports” rules if you use them.
// eslint-disable-next-line import/no-duplicates
import "side-effects";
// eslint-disable-next-line no-duplicate-imports, import/no-duplicates
import Thing from "side-effects";
import Other from "another";
// The above two lines will still be sorted after autofixing! This can be
// especially useful for long chunks of imports, where you don’t want one little
// edge case disable sorting for the whole thing. Even better is to try to fix
// the issue with the side effects – relying on import order is pretty brittle.

// If all else fails, you can use this trick of inserting code between imports
// to separate chunks of imports.
separator();
