import {
  // First, type imports (`export { type x, typeof y }` is a syntax error).
  type x,
  typeof y,
  // Numbers are sorted by their numeric value:
  img1,
  img2,
  img10,
  // Then everything else, alphabetically:
  k,
  L, // Case insensitive.
  m as anotherName, // Sorted by the original name “m”, not “anotherName”.
  m as tie, // But do use the \`as\` name in case of a tie.
  n,
} from "./x";
