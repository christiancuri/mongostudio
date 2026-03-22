import type { Monaco } from "@monaco-editor/react";

const OPERATOR_DOCS: Record<string, { summary: string; syntax: string; example: string }> = {
  $gt: {
    summary: "Matches values greater than a specified value.",
    syntax: "{ field: { $gt: value } }",
    example: "{ age: { $gt: 25 } }",
  },
  $gte: {
    summary: "Matches values greater than or equal to a specified value.",
    syntax: "{ field: { $gte: value } }",
    example: "{ age: { $gte: 18 } }",
  },
  $lt: {
    summary: "Matches values less than a specified value.",
    syntax: "{ field: { $lt: value } }",
    example: "{ price: { $lt: 100 } }",
  },
  $lte: {
    summary: "Matches values less than or equal to a specified value.",
    syntax: "{ field: { $lte: value } }",
    example: "{ score: { $lte: 50 } }",
  },
  $eq: {
    summary: "Matches values equal to a specified value.",
    syntax: "{ field: { $eq: value } }",
    example: '{ status: { $eq: "active" } }',
  },
  $ne: {
    summary: "Matches values not equal to a specified value.",
    syntax: "{ field: { $ne: value } }",
    example: '{ status: { $ne: "deleted" } }',
  },
  $in: {
    summary: "Matches any of the values in an array.",
    syntax: "{ field: { $in: [v1, v2, ...] } }",
    example: '{ status: { $in: ["active", "pending"] } }',
  },
  $nin: {
    summary: "Matches none of the values in an array.",
    syntax: "{ field: { $nin: [v1, v2, ...] } }",
    example: '{ role: { $nin: ["admin", "superadmin"] } }',
  },
  $and: {
    summary: "Joins query clauses with a logical AND.",
    syntax: "{ $and: [{ expr1 }, { expr2 }] }",
    example: '{ $and: [{ age: { $gt: 18 } }, { status: "active" }] }',
  },
  $or: {
    summary: "Joins query clauses with a logical OR.",
    syntax: "{ $or: [{ expr1 }, { expr2 }] }",
    example: '{ $or: [{ age: { $lt: 18 } }, { status: "vip" }] }',
  },
  $not: {
    summary: "Inverts the effect of a query expression.",
    syntax: "{ field: { $not: { operator-expression } } }",
    example: "{ price: { $not: { $gt: 100 } } }",
  },
  $exists: {
    summary: "Matches documents that have the specified field.",
    syntax: "{ field: { $exists: boolean } }",
    example: "{ email: { $exists: true } }",
  },
  $type: {
    summary: "Selects documents if a field is of the specified type.",
    syntax: '{ field: { $type: "type" } }',
    example: '{ age: { $type: "number" } }',
  },
  $regex: {
    summary: "Selects documents where values match a regular expression.",
    syntax: '{ field: { $regex: "pattern" } }',
    example: '{ name: { $regex: "^John" } }',
  },
  $set: {
    summary: "Sets the value of a field in a document.",
    syntax: "{ $set: { field: value } }",
    example: '{ $set: { status: "updated", modifiedAt: new Date() } }',
  },
  $unset: {
    summary: "Removes the specified field from a document.",
    syntax: '{ $unset: { field: "" } }',
    example: '{ $unset: { tempField: "" } }',
  },
  $inc: {
    summary: "Increments the value of the field by the specified amount.",
    syntax: "{ $inc: { field: amount } }",
    example: "{ $inc: { quantity: -2, totalPrice: 100 } }",
  },
  $push: {
    summary: "Appends a specified value to an array.",
    syntax: "{ $push: { field: value } }",
    example: '{ $push: { tags: "newTag" } }',
  },
  $pull: {
    summary: "Removes all array elements that match a specified query.",
    syntax: "{ $pull: { field: condition } }",
    example: '{ $pull: { fruits: "apple" } }',
  },
  $match: {
    summary:
      "Filters the documents to pass only the documents that match the specified condition(s).",
    syntax: "{ $match: { query } }",
    example: '{ $match: { status: "active" } }',
  },
  $group: {
    summary: "Groups input documents by the specified _id expression.",
    syntax: "{ $group: { _id: expression, field: { accumulator: expression } } }",
    example: '{ $group: { _id: "$department", total: { $sum: 1 } } }',
  },
  $sort: {
    summary: "Sorts all input documents.",
    syntax: "{ $sort: { field: 1 or -1 } }",
    example: "{ $sort: { createdAt: -1 } }",
  },
  $project: {
    summary: "Passes along documents with the requested fields.",
    syntax: "{ $project: { field1: 1, field2: 0 } }",
    example: '{ $project: { name: 1, _id: 0, fullName: { $concat: ["$first", " ", "$last"] } } }',
  },
  $unwind: {
    summary: "Deconstructs an array field from the input documents.",
    syntax: '{ $unwind: "$arrayField" }',
    example: '{ $unwind: "$items" }',
  },
  $lookup: {
    summary: "Performs a left outer join to another collection.",
    syntax:
      '{ $lookup: { from: "coll", localField: "field", foreignField: "field", as: "output" } }',
    example:
      '{ $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "orders" } }',
  },
  $limit: {
    summary: "Limits the number of documents passed to the next stage.",
    syntax: "{ $limit: number }",
    example: "{ $limit: 10 }",
  },
  $skip: {
    summary: "Skips a specified number of documents.",
    syntax: "{ $skip: number }",
    example: "{ $skip: 20 }",
  },
  $addFields: {
    summary: "Adds new fields to documents.",
    syntax: "{ $addFields: { newField: expression } }",
    example: '{ $addFields: { totalPrice: { $multiply: ["$price", "$quantity"] } } }',
  },
  $count: {
    summary: "Returns a count of the number of documents.",
    syntax: '{ $count: "fieldName" }',
    example: '{ $count: "totalDocs" }',
  },
  $facet: {
    summary: "Processes multiple aggregation pipelines.",
    syntax: "{ $facet: { output1: [stage1], output2: [stage2] } }",
    example:
      '{ $facet: { byCategory: [{ $group: { _id: "$cat" } }], total: [{ $count: "count" }] } }',
  },
};

export function registerHoverProvider(monaco: Monaco) {
  monaco.languages.registerHoverProvider("mongoShell", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      // Check if there's a $ before the word
      const lineContent = model.getLineContent(position.lineNumber);
      const charBefore = lineContent[word.startColumn - 2]; // -2 because columns are 1-based
      const fullWord = charBefore === "$" ? `$${word.word}` : word.word;

      const docs = OPERATOR_DOCS[fullWord];
      if (!docs) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: charBefore === "$" ? word.startColumn - 1 : word.startColumn,
          endColumn: word.endColumn,
        },
        contents: [
          { value: `**${fullWord}**` },
          { value: docs.summary },
          {
            value: `\`\`\`javascript\n// Syntax\n${docs.syntax}\n\n// Example\n${docs.example}\n\`\`\``,
          },
        ],
      };
    },
  });
}
