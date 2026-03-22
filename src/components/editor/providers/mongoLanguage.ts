import type { Monaco } from "@monaco-editor/react";

export function setupMonacoLanguage(monaco: Monaco) {
  // Only register once
  if (monaco.languages.getLanguages().some((l) => l.id === "mongoShell")) {
    return;
  }

  monaco.languages.register({ id: "mongoShell" });

  monaco.languages.setMonarchTokensProvider("mongoShell", {
    keywords: [
      "db",
      "var",
      "let",
      "const",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "do",
      "switch",
      "case",
      "break",
      "continue",
      "new",
      "this",
      "true",
      "false",
      "null",
      "undefined",
      "typeof",
      "instanceof",
      "in",
      "of",
      "try",
      "catch",
      "finally",
      "throw",
      "async",
      "await",
      "class",
      "extends",
      "import",
      "export",
      "default",
      "from",
    ],
    mongoMethods: [
      "find",
      "findOne",
      "aggregate",
      "insertOne",
      "insertMany",
      "updateOne",
      "updateMany",
      "replaceOne",
      "deleteOne",
      "deleteMany",
      "countDocuments",
      "estimatedDocumentCount",
      "distinct",
      "createIndex",
      "dropIndex",
      "getIndexes",
      "drop",
      "rename",
      "stats",
      "bulkWrite",
      "watch",
      "mapReduce",
    ],
    mongoObjects: [
      "ObjectId",
      "ISODate",
      "NumberLong",
      "NumberInt",
      "NumberDecimal",
      "Timestamp",
      "BinData",
      "UUID",
      "MinKey",
      "MaxKey",
      "RegExp",
      "Date",
    ],
    operators: [
      "$gt",
      "$gte",
      "$lt",
      "$lte",
      "$eq",
      "$ne",
      "$in",
      "$nin",
      "$and",
      "$or",
      "$not",
      "$nor",
      "$exists",
      "$type",
      "$regex",
      "$text",
      "$where",
      "$all",
      "$elemMatch",
      "$size",
      "$slice",
      "$set",
      "$unset",
      "$inc",
      "$push",
      "$pull",
      "$addToSet",
      "$pop",
      "$match",
      "$group",
      "$sort",
      "$limit",
      "$skip",
      "$project",
      "$unwind",
      "$lookup",
      "$facet",
      "$bucket",
      "$sample",
      "$count",
      "$merge",
      "$out",
      "$replaceRoot",
      "$addFields",
    ],
    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],

        // Strings
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        [/`/, "string", "@string_backtick"],

        // Numbers
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+/, "number"],

        // MongoDB operators
        [
          /\$[a-zA-Z]+/,
          {
            cases: {
              "@operators": "keyword",
              "@default": "variable",
            },
          },
        ],

        // MongoDB objects/constructors
        [
          /[A-Z][a-zA-Z]*/,
          {
            cases: {
              "@mongoObjects": "type",
              "@default": "identifier",
            },
          },
        ],

        // Methods and identifiers
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@mongoMethods": "method",
              db: "variable.predefined",
              "@default": "identifier",
            },
          },
        ],

        // Delimiters and operators
        [/[{}()\[\]]/, "@brackets"],
        [/[;,.]/, "delimiter"],
        [/[<>]=?|[!=]=?=?|[+\-*\/%&|^~]/, "operator"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
      string_double: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],
      string_single: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
      string_backtick: [
        [/\$\{/, { token: "delimiter.bracket", next: "@bracketCounting" }],
        [/[^\\`$]+/, "string"],
        [/\\./, "string.escape"],
        [/`/, "string", "@pop"],
      ],
      bracketCounting: [
        [/\{/, "delimiter.bracket", "@bracketCounting"],
        [/\}/, "delimiter.bracket", "@pop"],
        { include: "root" },
      ],
    },
  });

  // Language config for auto-closing pairs etc.
  monaco.languages.setLanguageConfiguration("mongoShell", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}"']*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  });
}
