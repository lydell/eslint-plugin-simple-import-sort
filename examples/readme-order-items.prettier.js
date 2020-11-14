import {
  // First, type imports. (`export { type x, typeof y }` is a syntax error).
  type x,
  typeof y,
  // Numbers are sorted by their numeric value:
  img1,
  img2,
  img10,
  // Then everything else, alphabetically:
  k,
  L, // Case insensitive.
  m as anotherName, // Sorted by the “external interface” name “m”, not “anotherName”.
  m as tie, // But do use the file-local name in case of a tie.
  n,
} from "./x";

export {
  k,
  L, // Case insensitive.
  anotherName as m, // Sorted by the “external interface” name “m”, not “anotherName”.
  // tie as m, // For exports there can’t be ties – all exports must be unique.
  n,
};
export type { A, B, A as C };

var k_, L_, anotherName_, n_;
type A = 1;
type B = 1;
