import React from "react";
import Button from "../Button";

import styles from "./styles.css";
import type { User } from "../../types";
import { getUser } from "../../api";

import PropTypes from "prop-types";
import classnames from "classnames";
import { truncate, formatNumber } from "../../utils";
