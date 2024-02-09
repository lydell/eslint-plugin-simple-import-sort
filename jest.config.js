"use strict";

const expectedCoverage = process.version.startsWith("v14") ? 98 : 100;

module.exports = {
  collectCoverageFrom: ["src/**/*.js"],
  coverageThreshold: {
    global: {
      branches: expectedCoverage,
      functions: expectedCoverage,
      lines: expectedCoverage,
      statements: expectedCoverage,
    },
  },
};
