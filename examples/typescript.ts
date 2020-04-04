import React from "react";
import Button from "../Button";

import styles from "./styles.css";
import { getUser } from "../../api";

import PropTypes from "prop-types";
import classnames from "classnames";
import { truncate, formatNumber } from "../../utils";

// The above is the same as readme-example.prettier.js. The below function is here to
// make sure that this file isn’t both valid JS and valid TS, forcing the need
// for `@typescript-eslint/parser`.
function pluck<T, K extends keyof T>(o: T, names: K[]): T[K][] {
  return names.map(n => o[n]);
}
