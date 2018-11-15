import { // comment at start
  /* c1 */ c /* c2 */, // c3
  // b1

  b as /* b2 */ renamed
  , /* b3 */ /* a1
  */ a /* not-a
  */ // comment at end
} from "wherever";
import {
  e,
  d, /* d */ /* not-d
  */ // comment at end after trailing comma
} from "wherever2";
import {/* comment at start */ g, /* g */ f /* f */} from "wherever3";
