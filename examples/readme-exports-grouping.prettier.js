export * from "x";
export * from "y";

// This comment starts a new group.
/* This one does not. */ export * from "a"; // Neither does this one.
/* Nor this
one */ export * from "b";
/* But this one does. */
export * from "./";
