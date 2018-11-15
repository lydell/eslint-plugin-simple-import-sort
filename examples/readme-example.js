import React from "react";
import PropTypes from "prop-types";
import Button from "../Button";
import classnames from "classnames";

import { getUser } from "../../api";
import type { User } from "../../types";
import styles from "./styles.css";
import { truncate, formatNumber } from "../../utils";
