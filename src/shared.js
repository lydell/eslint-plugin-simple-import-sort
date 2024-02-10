"use strict";

// A “chunk” is a sequence of statements of a certain type with only comments
// and whitespace between.
function extractChunks(parentNode, isPartOfChunk) {
  const chunks = [];
  let chunk = [];
  let lastNode = undefined;

  for (const node of parentNode.body) {
    const result = isPartOfChunk(node, lastNode);
    switch (result) {
      case "PartOfChunk":
        chunk.push(node);
        break;

      case "PartOfNewChunk":
        if (chunk.length > 0) {
          chunks.push(chunk);
        }
        chunk = [node];
        break;

      case "NotPartOfChunk":
        if (chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
        }
        break;

      /* v8 ignore start */
      default:
        throw new Error(`Unknown chunk result: ${result}`);
      /* v8 ignore stop */
    }

    lastNode = node;
  }

  if (chunk.length > 0) {
    chunks.push(chunk);
  }

  return chunks;
}

function maybeReportSorting(context, sorted, start, end) {
  const sourceCode = getSourceCode(context);
  const original = sourceCode.getText().slice(start, end);
  if (original !== sorted) {
    context.report({
      messageId: "sort",
      loc: {
        start: sourceCode.getLocFromIndex(start),
        end: sourceCode.getLocFromIndex(end),
      },
      fix: (fixer) => fixer.replaceTextRange([start, end], sorted),
    });
  }
}

function printSortedItems(sortedItems, originalItems, sourceCode) {
  const newline = guessNewline(sourceCode);

  const sorted = sortedItems
    .map((groups) =>
      groups
        .map((groupItems) => groupItems.map((item) => item.code).join(newline))
        .join(newline),
    )
    .join(newline + newline);

  // Edge case: If the last import/export (after sorting) ends with a line
  // comment and there’s code (or a multiline block comment) on the same line,
  // add a newline so we don’t accidentally comment stuff out.
  const flattened = flatMap(sortedItems, (groups) => [].concat(...groups));
  const lastSortedItem = flattened[flattened.length - 1];
  const lastOriginalItem = originalItems[originalItems.length - 1];
  const nextToken = lastSortedItem.needsNewline
    ? sourceCode.getTokenAfter(lastOriginalItem.node, {
        includeComments: true,
        filter: (token) =>
          !isLineComment(token) &&
          !(
            isBlockComment(token) &&
            token.loc.end.line === lastOriginalItem.node.loc.end.line
          ),
      })
    : undefined;
  const maybeNewline =
    nextToken != null &&
    nextToken.loc.start.line === lastOriginalItem.node.loc.end.line
      ? newline
      : "";

  return sorted + maybeNewline;
}

// Wrap the import/export nodes in `passedChunk` in objects with more data about
// the import/export. Most importantly there’s a `code` property that contains
// the node as a string, with comments (if any). Finding the corresponding
// comments is the hard part.
function getImportExportItems(
  passedChunk,
  sourceCode,
  isSideEffectImport,
  getSpecifiers,
) {
  const chunk = handleLastSemicolon(passedChunk, sourceCode);
  return chunk.map((node, nodeIndex) => {
    const lastLine =
      nodeIndex === 0
        ? node.loc.start.line - 1
        : chunk[nodeIndex - 1].loc.end.line;

    // Get all comments before the import/export, except:
    //
    // - Comments on another line for the first import/export.
    // - Comments that belong to the previous import/export (if any) – that is,
    //   comments that are on the same line as the previous import/export. But
    //   multiline block comments always belong to this import/export, not the
    //   previous.
    const commentsBefore = sourceCode
      .getCommentsBefore(node)
      .filter(
        (comment) =>
          comment.loc.start.line <= node.loc.start.line &&
          comment.loc.end.line > lastLine &&
          (nodeIndex > 0 || comment.loc.start.line > lastLine),
      );

    // Get all comments after the import/export that are on the same line.
    // Multiline block comments belong to the _next_ import/export (or the
    // following code in case of the last import/export).
    const commentsAfter = sourceCode
      .getCommentsAfter(node)
      .filter((comment) => comment.loc.end.line === node.loc.end.line);

    const before = printCommentsBefore(node, commentsBefore, sourceCode);
    const after = printCommentsAfter(node, commentsAfter, sourceCode);

    // Print the indentation before the import/export or its first comment, if
    // any, to support indentation in `<script>` tags.
    const indentation = getIndentation(
      commentsBefore.length > 0 ? commentsBefore[0] : node,
      sourceCode,
    );

    // Print spaces after the import/export or its last comment, if any, to
    // avoid producing a sort error just because you accidentally added a few
    // trailing spaces among the imports/exports.
    const trailingSpaces = getTrailingSpaces(
      commentsAfter.length > 0 ? commentsAfter[commentsAfter.length - 1] : node,
      sourceCode,
    );

    const code =
      indentation +
      before +
      printWithSortedSpecifiers(node, sourceCode, getSpecifiers) +
      after +
      trailingSpaces;

    const all = [...commentsBefore, node, ...commentsAfter];
    const [start] = all[0].range;
    const [, end] = all[all.length - 1].range;

    const source = getSource(node);

    return {
      node,
      code,
      start: start - indentation.length,
      end: end + trailingSpaces.length,
      isSideEffectImport: isSideEffectImport(node, sourceCode),
      source,
      index: nodeIndex,
      needsNewline:
        commentsAfter.length > 0 &&
        isLineComment(commentsAfter[commentsAfter.length - 1]),
    };
  });
}

// Parsers think that a semicolon after a statement belongs to that statement.
// But in a semicolon-free code style it might belong to the next statement:
//
//     import x from "x"
//     ;[].forEach()
//
// If the last import/export of a chunk ends with a semicolon, and that
// semicolon isn’t located on the same line as the `from` string, adjust the
// node to end at the `from` string instead.
//
// In the above example, the import is adjusted to end after `"x"`.
function handleLastSemicolon(chunk, sourceCode) {
  const lastIndex = chunk.length - 1;
  const lastNode = chunk[lastIndex];
  const [nextToLastToken, lastToken] = sourceCode.getLastTokens(lastNode, {
    count: 2,
  });
  const lastIsSemicolon = isPunctuator(lastToken, ";");

  if (!lastIsSemicolon) {
    return chunk;
  }

  const semicolonBelongsToNode =
    nextToLastToken.loc.end.line === lastToken.loc.start.line ||
    // If there’s no more code after the last import/export the semicolon has to
    // belong to the import/export, even if it is not on the same line.
    sourceCode.getTokenAfter(lastToken) == null;

  if (semicolonBelongsToNode) {
    return chunk;
  }

  // Preserve the start position, but use the end position of the `from` string.
  const newLastNode = {
    ...lastNode,
    range: [lastNode.range[0], nextToLastToken.range[1]],
    loc: {
      start: lastNode.loc.start,
      end: nextToLastToken.loc.end,
    },
  };

  return chunk.slice(0, lastIndex).concat(newLastNode);
}

function printWithSortedSpecifiers(node, sourceCode, getSpecifiers) {
  const allTokens = getAllTokens(node, sourceCode);
  const openBraceIndex = allTokens.findIndex((token) =>
    isPunctuator(token, "{"),
  );
  const closeBraceIndex = allTokens.findIndex((token) =>
    isPunctuator(token, "}"),
  );

  const specifiers = getSpecifiers(node);

  if (
    openBraceIndex === -1 ||
    closeBraceIndex === -1 ||
    specifiers.length <= 1
  ) {
    return printTokens(allTokens);
  }

  const specifierTokens = allTokens.slice(openBraceIndex + 1, closeBraceIndex);
  const itemsResult = getSpecifierItems(specifierTokens, sourceCode);

  const items = itemsResult.items.map((originalItem, index) => ({
    ...originalItem,
    node: specifiers[index],
  }));

  const sortedItems = sortSpecifierItems(items);

  const newline = guessNewline(sourceCode);

  // `allTokens[closeBraceIndex - 1]` wouldn’t work because `allTokens` contains
  // comments and whitespace.
  const hasTrailingComma = isPunctuator(
    sourceCode.getTokenBefore(allTokens[closeBraceIndex]),
    ",",
  );

  const lastIndex = sortedItems.length - 1;
  const sorted = flatMap(sortedItems, (item, index) => {
    const previous = index === 0 ? undefined : sortedItems[index - 1];

    // Add a newline if the item needs one, unless the previous item (if any)
    // already ends with a newline.
    const maybeNewline =
      previous != null &&
      needsStartingNewline(item.before) &&
      !(
        previous.after.length > 0 &&
        isNewline(previous.after[previous.after.length - 1])
      )
        ? [{ type: "Newline", code: newline }]
        : [];

    if (index < lastIndex || hasTrailingComma) {
      return [
        ...maybeNewline,
        ...item.before,
        ...item.specifier,
        { type: "Comma", code: "," },
        ...item.after,
      ];
    }

    const nonBlankIndex = item.after.findIndex(
      (token) => !isNewline(token) && !isSpaces(token),
    );

    // Remove whitespace and newlines at the start of `.after` if the item had a
    // comma before, but now hasn’t to avoid blank lines and excessive
    // whitespace before `}`.
    const after = !item.hadComma
      ? item.after
      : nonBlankIndex === -1
        ? []
        : item.after.slice(nonBlankIndex);

    return [...maybeNewline, ...item.before, ...item.specifier, ...after];
  });

  const maybeNewline =
    needsStartingNewline(itemsResult.after) &&
    !isNewline(sorted[sorted.length - 1])
      ? [{ type: "Newline", code: newline }]
      : [];

  return printTokens([
    ...allTokens.slice(0, openBraceIndex + 1),
    ...itemsResult.before,
    ...sorted,
    ...maybeNewline,
    ...itemsResult.after,
    ...allTokens.slice(closeBraceIndex),
  ]);
}

// Turns a list of tokens between the `{` and `}` of an import/export specifiers
// list into an object with the following properties:
//
// - before: Array of tokens – whitespace and comments after the `{` that do not
//   belong to any specifier.
// - after: Array of tokens – whitespace and comments before the `}` that do not
//   belong to any specifier.
// - items: Array of specifier items.
//
// Each specifier item looks like this:
//
// - before: Array of tokens – whitespace and comments before the specifier.
// - after: Array of tokens – whitespace and comments after the specifier.
// - specifier: Array of tokens – identifiers, whitespace and comments of the
//   specifier.
// - hadComma: A Boolean representing if the specifier had a comma originally.
//
// We have to do carefully preserve all original whitespace this way in order to
// be compatible with other stylistic ESLint rules.
function getSpecifierItems(tokens) {
  const result = {
    before: [],
    after: [],
    items: [],
  };

  let current = makeEmptyItem();

  for (const token of tokens) {
    switch (current.state) {
      case "before":
        switch (token.type) {
          case "Newline":
            current.before.push(token);

            // All whitespace and comments before the first newline or
            // identifier belong to the `{`, not the first specifier.
            if (result.before.length === 0 && result.items.length === 0) {
              result.before = current.before;
              current = makeEmptyItem();
            }
            break;

          case "Spaces":
          case "Block":
          case "Line":
            current.before.push(token);
            break;

          // We’ve reached an identifier.
          default:
            // All whitespace and comments before the first newline or
            // identifier belong to the `{`, not the first specifier.
            if (result.before.length === 0 && result.items.length === 0) {
              result.before = current.before;
              current = makeEmptyItem();
            }

            current.state = "specifier";
            current.specifier.push(token);
        }
        break;

      case "specifier":
        switch (token.type) {
          case "Punctuator":
            // There can only be comma punctuators, but future-proof by checking.
            if (isPunctuator(token, ",")) {
              current.hadComma = true;
              current.state = "after";
              /* v8 ignore start */
            } else {
              current.specifier.push(token);
            }
            /* v8 ignore stop */
            break;

          // When consuming the specifier part, we eat every token until a comma
          // or to the end, basically.
          default:
            current.specifier.push(token);
        }
        break;

      case "after":
        switch (token.type) {
          // Only whitespace and comments after a specifier that are on the same
          // belong to the specifier.
          case "Newline":
            current.after.push(token);
            result.items.push(current);
            current = makeEmptyItem();
            break;

          case "Spaces":
          case "Line":
            current.after.push(token);
            break;

          case "Block":
            // Multiline block comments belong to the next specifier.
            if (hasNewline(token.code)) {
              result.items.push(current);
              current = makeEmptyItem();
              current.before.push(token);
            } else {
              current.after.push(token);
            }
            break;

          // We’ve reached another specifier – time to process that one.
          default:
            result.items.push(current);
            current = makeEmptyItem();
            current.state = "specifier";
            current.specifier.push(token);
        }
        break;

      /* v8 ignore start */
      default:
        throw new Error(`Unknown state: ${current.state}`);
      /* v8 ignore stop */
    }
  }

  // We’ve reached the end of the tokens. Handle what’s currently in `current`.
  switch (current.state) {
    // If the last specifier has a trailing comma and some of the remaining
    // whitespace and comments are on the same line we end up here. If so we
    // want to put that whitespace and comments in `result.after`.
    case "before":
      result.after = current.before;
      break;

    // If the last specifier has no trailing comma we end up here. Move all
    // trailing comments and whitespace from `.specifier` to `.after`, and
    // comments and whitespace that don’t belong to the specifier to
    // `result.after`. The last non-comment and non-whitespace token is usually
    // an identifier, but in this case it’s a keyword:
    //
    //    export { z, d as default } from "a"
    case "specifier": {
      const lastIdentifierIndex = findLastIndex(
        current.specifier,
        (token2) => isIdentifier(token2) || isKeyword(token2),
      );

      const specifier = current.specifier.slice(0, lastIdentifierIndex + 1);
      const after = current.specifier.slice(lastIdentifierIndex + 1);

      // If there’s a newline, put everything up to and including (hence the `+
      // 1`) that newline in the specifiers’s `.after`.
      const newlineIndexRaw = after.findIndex((token2) => isNewline(token2));
      const newlineIndex = newlineIndexRaw === -1 ? -1 : newlineIndexRaw + 1;

      // If there’s a multiline block comment, put everything _before_ that
      // comment in the specifiers’s `.after`.
      const multilineBlockCommentIndex = after.findIndex(
        (token2) => isBlockComment(token2) && hasNewline(token2.code),
      );

      const sliceIndex =
        // If both a newline and a multiline block comment exists, choose the
        // earlier one.
        newlineIndex >= 0 && multilineBlockCommentIndex >= 0
          ? Math.min(newlineIndex, multilineBlockCommentIndex)
          : newlineIndex >= 0
            ? newlineIndex
            : multilineBlockCommentIndex >= 0
              ? multilineBlockCommentIndex
              : // If there are no newlines, move the last whitespace into `result.after`.
                endsWithSpaces(after)
                ? after.length - 1
                : -1;

      current.specifier = specifier;
      current.after = sliceIndex === -1 ? after : after.slice(0, sliceIndex);
      result.items.push(current);
      result.after = sliceIndex === -1 ? [] : after.slice(sliceIndex);

      break;
    }

    // If the last specifier has a trailing comma and all remaining whitespace
    // and comments are on the same line we end up here. If so we want to move
    // the final whitespace to `result.after`.
    case "after":
      if (endsWithSpaces(current.after)) {
        const last = current.after.pop();
        result.after = [last];
      }
      result.items.push(current);
      break;

    /* v8 ignore start */
    default:
      throw new Error(`Unknown state: ${current.state}`);
    /* v8 ignore stop */
  }

  return result;
}

function makeEmptyItem() {
  return {
    // "before" | "specifier" | "after"
    state: "before",
    before: [],
    after: [],
    specifier: [],
    hadComma: false,
  };
}

// If a specifier item starts with a line comment or a singleline block comment
// it needs a newline before that. Otherwise that comment can end up belonging
// to the _previous_ specifier after sorting.
function needsStartingNewline(tokens) {
  const before = tokens.filter((token) => !isSpaces(token));

  if (before.length === 0) {
    return false;
  }

  const firstToken = before[0];
  return (
    isLineComment(firstToken) ||
    (isBlockComment(firstToken) && !hasNewline(firstToken.code))
  );
}

function endsWithSpaces(tokens) {
  const last = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
  return last == null ? false : isSpaces(last);
}

const NEWLINE = /(\r?\n)/;

function hasNewline(string) {
  return NEWLINE.test(string);
}

function guessNewline(sourceCode) {
  const match = NEWLINE.exec(sourceCode.text);
  return match == null ? "\n" : match[0];
}

function parseWhitespace(whitespace) {
  const allItems = whitespace.split(NEWLINE);

  // Remove blank lines. `allItems` contains alternating `spaces` (which can be
  // the empty string) and `newline` (which is either "\r\n" or "\n"). So in
  // practice `allItems` grows like this as there are more newlines in
  // `whitespace`:
  //
  //     [spaces]
  //     [spaces, newline, spaces]
  //     [spaces, newline, spaces, newline, spaces]
  //     [spaces, newline, spaces, newline, spaces, newline, spaces]
  //
  // If there are 5 or more items we have at least one blank line. If so, keep
  // the first `spaces`, the first `newline` and the last `spaces`.
  const items =
    allItems.length >= 5
      ? allItems.slice(0, 2).concat(allItems.slice(-1))
      : allItems;

  return (
    items
      .map((spacesOrNewline, index) =>
        index % 2 === 0
          ? { type: "Spaces", code: spacesOrNewline }
          : { type: "Newline", code: spacesOrNewline },
      )
      // Remove empty spaces since it makes debugging easier.
      .filter((token) => token.code !== "")
  );
}

function removeBlankLines(whitespace) {
  return printTokens(parseWhitespace(whitespace));
}

// Returns `sourceCode.getTokens(node)` plus whitespace and comments. All tokens
// have a `code` property with `sourceCode.getText(token)`.
function getAllTokens(node, sourceCode) {
  const tokens = sourceCode.getTokens(node);
  const lastTokenIndex = tokens.length - 1;
  return flatMap(tokens, (token, tokenIndex) => {
    const newToken = { ...token, code: sourceCode.getText(token) };

    if (tokenIndex === lastTokenIndex) {
      return [newToken];
    }

    const comments = sourceCode.getCommentsAfter(token);
    const last = comments.length > 0 ? comments[comments.length - 1] : token;
    const nextToken = tokens[tokenIndex + 1];

    return [
      newToken,
      ...flatMap(comments, (comment, commentIndex) => {
        const previous =
          commentIndex === 0 ? token : comments[commentIndex - 1];
        return [
          ...parseWhitespace(
            sourceCode.text.slice(previous.range[1], comment.range[0]),
          ),
          { ...comment, code: sourceCode.getText(comment) },
        ];
      }),
      ...parseWhitespace(
        sourceCode.text.slice(last.range[1], nextToken.range[0]),
      ),
    ];
  });
}

// Prints tokens that are enhanced with a `code` property – like those returned
// by `getAllTokens` and `parseWhitespace`.
function printTokens(tokens) {
  return tokens.map((token) => token.code).join("");
}

// `comments` is a list of comments that occur before `node`. Print those and
// the whitespace between themselves and between `node`.
function printCommentsBefore(node, comments, sourceCode) {
  const lastIndex = comments.length - 1;
  return comments
    .map((comment, index) => {
      const next = index === lastIndex ? node : comments[index + 1];
      return (
        sourceCode.getText(comment) +
        removeBlankLines(sourceCode.text.slice(comment.range[1], next.range[0]))
      );
    })
    .join("");
}

// `comments` is a list of comments that occur after `node`. Print those and
// the whitespace between themselves and between `node`.
function printCommentsAfter(node, comments, sourceCode) {
  return comments
    .map((comment, index) => {
      const previous = index === 0 ? node : comments[index - 1];
      return (
        removeBlankLines(
          sourceCode.text.slice(previous.range[1], comment.range[0]),
        ) + sourceCode.getText(comment)
      );
    })
    .join("");
}

function getIndentation(node, sourceCode) {
  const tokenBefore = sourceCode.getTokenBefore(node, {
    includeComments: true,
  });
  if (tokenBefore == null) {
    const text = sourceCode.text.slice(0, node.range[0]);
    const lines = text.split(NEWLINE);
    return lines[lines.length - 1];
  }
  const text = sourceCode.text.slice(tokenBefore.range[1], node.range[0]);
  const lines = text.split(NEWLINE);
  return lines.length > 1 ? lines[lines.length - 1] : "";
}

function getTrailingSpaces(node, sourceCode) {
  const tokenAfter = sourceCode.getTokenAfter(node, {
    includeComments: true,
  });
  if (tokenAfter == null) {
    const text = sourceCode.text.slice(node.range[1]);
    const lines = text.split(NEWLINE);
    return lines[0];
  }
  const text = sourceCode.text.slice(node.range[1], tokenAfter.range[0]);
  const lines = text.split(NEWLINE);
  return lines[0];
}

function sortImportExportItems(items) {
  return items.slice().sort((itemA, itemB) =>
    // If both items are side effect imports, keep their original order.
    itemA.isSideEffectImport && itemB.isSideEffectImport
      ? itemA.index - itemB.index
      : // If one of the items is a side effect import, move it first.
        itemA.isSideEffectImport
        ? -1
        : itemB.isSideEffectImport
          ? 1
          : // Compare the `from` part.
            compare(itemA.source.source, itemB.source.source) ||
            // The `.source` has been slightly tweaked. To stay fully deterministic,
            // also sort on the original value.
            compare(itemA.source.originalSource, itemB.source.originalSource) ||
            // Then put type imports/exports before regular ones.
            compare(itemA.source.kind, itemB.source.kind) ||
            // Keep the original order if the sources are the same. It’s not worth
            // trying to compare anything else, and you can use `import/no-duplicates`
            // to get rid of the problem anyway.
            itemA.index - itemB.index,
  );
}

function sortSpecifierItems(items) {
  return items.slice().sort(
    (itemA, itemB) =>
      // Compare by imported or exported name (external interface name).
      // import { a as b } from "a"
      //          ^
      // export { b as a }
      //               ^
      compare(
        (itemA.node.imported || itemA.node.exported).name,
        (itemB.node.imported || itemB.node.exported).name,
      ) ||
      // Then compare by the file-local name.
      // import { a as b } from "a"
      //               ^
      // export { b as a }
      //          ^
      compare(itemA.node.local.name, itemB.node.local.name) ||
      // Then put type specifiers before regular ones.
      compare(
        getImportExportKind(itemA.node),
        getImportExportKind(itemB.node),
        /* v8 ignore start */
      ) ||
      // Keep the original order if the names are the same. It’s not worth
      // trying to compare anything else, `import {a, a} from "mod"` is a syntax
      // error anyway (but @babel/eslint-parser kind of supports it).
      itemA.index - itemB.index,
    /* v8 ignore stop */
  );
}

const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compare(a, b) {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

function isIdentifier(node) {
  return node.type === "Identifier";
}

function isKeyword(node) {
  return node.type === "Keyword";
}

function isPunctuator(node, value) {
  return node.type === "Punctuator" && node.value === value;
}

function isBlockComment(node) {
  return node.type === "Block";
}

function isLineComment(node) {
  return node.type === "Line";
}

function isSpaces(node) {
  return node.type === "Spaces";
}

function isNewline(node) {
  return node.type === "Newline";
}

function getSource(node) {
  const source = node.source.value;

  return {
    // Sort by directory level rather than by string length.
    source: source
      // Treat `.` as `./`, `..` as `../`, `../..` as `../../` etc.
      .replace(/^[./]*\.$/, "$&/")
      // Make `../` sort after `../../` but before `../a` etc.
      // Why a comma? See the next comment.
      .replace(/^[./]*\/$/, "$&,")
      // Make `.` and `/` sort before any other punctuation.
      // The default order is: _ - , x x x . x x x / x x x
      // We’re changing it to: . / , x x x _ x x x - x x x
      .replace(/[./_-]/g, (char) => {
        switch (char) {
          case ".":
            return "_";
          case "/":
            return "-";
          case "_":
            return ".";
          case "-":
            return "/";
          /* v8 ignore start */
          default:
            throw new Error(`Unknown source substitution character: ${char}`);
          /* v8 ignore stop */
        }
      }),
    originalSource: source,
    kind: getImportExportKind(node),
  };
}

function getImportExportKind(node) {
  // `type` and `typeof` imports, as well as `type` exports (there are no
  // `typeof` exports).
  return node.importKind || node.exportKind || "value";
}

// Like `Array.prototype.findIndex`, but searches from the end.
function findLastIndex(array, fn) {
  for (let index = array.length - 1; index >= 0; index--) {
    if (fn(array[index], index, array)) {
      return index;
    }
  }
  /* v8 ignore start */
  // There are currently no usages of `findLastIndex` where nothing is found.
  return -1;
  /* v8 ignore stop */
}

// Like `Array.prototype.flatMap`, had it been available.
function flatMap(array, fn) {
  return [].concat(...array.map(fn));
}

function getSourceCode(context) {
  // `.getSourceCode()` is deprecated in favor of `.sourceCode`.
  // We support both for now.
  /* v8 ignore next */
  return context.sourceCode || context.getSourceCode();
}

module.exports = {
  extractChunks,
  flatMap,
  getImportExportItems,
  getSourceCode,
  isPunctuator,
  maybeReportSorting,
  printSortedItems,
  printWithSortedSpecifiers,
  sortImportExportItems,
};
