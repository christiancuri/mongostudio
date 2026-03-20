import type { Monaco } from "@monaco-editor/react";
import type { languages, editor, Position, CancellationToken } from "monaco-editor";

const COLLECTION_METHODS = [
  { label: "find", detail: "(filter?, projection?) -> Cursor", insertText: "find({$1})", documentation: "Selects documents in a collection or view and returns a cursor." },
  { label: "findOne", detail: "(filter?, projection?) -> Document", insertText: "findOne({$1})", documentation: "Returns one document that satisfies the specified query criteria." },
  { label: "aggregate", detail: "(pipeline) -> Cursor", insertText: "aggregate([\n  { \\$match: {$1} }\n])", documentation: "Calculates aggregate values for the data in a collection." },
  { label: "insertOne", detail: "(document) -> InsertResult", insertText: "insertOne({\n  $1\n})", documentation: "Inserts a single document into a collection." },
  { label: "insertMany", detail: "(documents) -> InsertResult", insertText: "insertMany([\n  {$1}\n])", documentation: "Inserts multiple documents into a collection." },
  { label: "updateOne", detail: "(filter, update) -> UpdateResult", insertText: "updateOne(\n  { $1 },\n  { \\$set: { $2 } }\n)", documentation: "Updates a single document within the collection." },
  { label: "updateMany", detail: "(filter, update) -> UpdateResult", insertText: "updateMany(\n  { $1 },\n  { \\$set: { $2 } }\n)", documentation: "Updates all documents that match the filter." },
  { label: "deleteOne", detail: "(filter) -> DeleteResult", insertText: "deleteOne({ $1 })", documentation: "Removes a single document from a collection." },
  { label: "deleteMany", detail: "(filter) -> DeleteResult", insertText: "deleteMany({ $1 })", documentation: "Removes all documents that match the filter." },
  { label: "countDocuments", detail: "(filter?) -> number", insertText: "countDocuments({$1})", documentation: "Returns the count of documents that match the query." },
  { label: "distinct", detail: "(field, filter?) -> Array", insertText: 'distinct("$1")', documentation: "Finds the distinct values for a specified field." },
  { label: "createIndex", detail: "(keys, options?) -> string", insertText: "createIndex({ $1: 1 })", documentation: "Creates an index on the specified field(s)." },
  { label: "dropIndex", detail: "(name) -> void", insertText: 'dropIndex("$1")', documentation: "Drops the specified index from a collection." },
  { label: "getIndexes", detail: "() -> Array", insertText: "getIndexes()", documentation: "Returns an array of documents that describe the existing indexes." },
  { label: "drop", detail: "() -> boolean", insertText: "drop()", documentation: "Removes a collection or view from the database." },
  { label: "stats", detail: "() -> Object", insertText: "stats()", documentation: "Returns statistics about the collection." },
  { label: "replaceOne", detail: "(filter, replacement) -> UpdateResult", insertText: "replaceOne(\n  { $1 },\n  { $2 }\n)", documentation: "Replaces a single document within the collection." },
  { label: "bulkWrite", detail: "(operations) -> BulkWriteResult", insertText: "bulkWrite([\n  $1\n])", documentation: "Performs multiple write operations." },
];

const QUERY_OPERATORS = [
  // Comparison
  { label: "$gt", detail: "Greater than", insertText: "\\$gt: $1", documentation: "Matches values that are greater than a specified value." },
  { label: "$gte", detail: "Greater than or equal", insertText: "\\$gte: $1", documentation: "Matches values greater than or equal to a specified value." },
  { label: "$lt", detail: "Less than", insertText: "\\$lt: $1", documentation: "Matches values less than a specified value." },
  { label: "$lte", detail: "Less than or equal", insertText: "\\$lte: $1", documentation: "Matches values less than or equal to a specified value." },
  { label: "$eq", detail: "Equals", insertText: "\\$eq: $1", documentation: "Matches values equal to a specified value." },
  { label: "$ne", detail: "Not equal", insertText: "\\$ne: $1", documentation: "Matches values not equal to a specified value." },
  { label: "$in", detail: "In array", insertText: "\\$in: [$1]", documentation: "Matches any of the values specified in an array." },
  { label: "$nin", detail: "Not in array", insertText: "\\$nin: [$1]", documentation: "Matches none of the values specified in an array." },
  // Logical
  { label: "$and", detail: "Logical AND", insertText: "\\$and: [{ $1 }]", documentation: "Joins query clauses with a logical AND." },
  { label: "$or", detail: "Logical OR", insertText: "\\$or: [{ $1 }]", documentation: "Joins query clauses with a logical OR." },
  { label: "$not", detail: "Logical NOT", insertText: "\\$not: { $1 }", documentation: "Inverts the effect of a query expression." },
  { label: "$nor", detail: "Logical NOR", insertText: "\\$nor: [{ $1 }]", documentation: "Joins query clauses with a logical NOR." },
  // Element
  { label: "$exists", detail: "Field exists", insertText: "\\$exists: true", documentation: "Matches documents that have the specified field." },
  { label: "$type", detail: "BSON type", insertText: '\\$type: "$1"', documentation: "Selects documents with a specific field type." },
  // Evaluation
  { label: "$regex", detail: "Regular expression", insertText: '\\$regex: "$1"', documentation: "Selects documents matching a regular expression." },
  { label: "$text", detail: "Text search", insertText: '\\$text: { \\$search: "$1" }', documentation: "Performs text search." },
  // Array
  { label: "$all", detail: "All elements match", insertText: "\\$all: [$1]", documentation: "Matches arrays containing all specified elements." },
  { label: "$elemMatch", detail: "Element match", insertText: "\\$elemMatch: { $1 }", documentation: "Selects documents with array element matching conditions." },
  { label: "$size", detail: "Array size", insertText: "\\$size: $1", documentation: "Selects documents with array of specified size." },
  // Update
  { label: "$set", detail: "Set field value", insertText: "\\$set: { $1 }", documentation: "Sets the value of a field." },
  { label: "$unset", detail: "Remove field", insertText: '\\$unset: { "$1": "" }', documentation: "Removes the specified field from a document." },
  { label: "$inc", detail: "Increment", insertText: "\\$inc: { $1: 1 }", documentation: "Increments the value of a field by a specified amount." },
  { label: "$push", detail: "Push to array", insertText: "\\$push: { $1 }", documentation: "Adds an element to an array." },
  { label: "$pull", detail: "Pull from array", insertText: "\\$pull: { $1 }", documentation: "Removes all array elements matching a condition." },
  { label: "$addToSet", detail: "Add to set", insertText: "\\$addToSet: { $1 }", documentation: "Adds elements to array only if they don't already exist." },
  // Aggregation stages
  { label: "$match", detail: "Filter documents", insertText: "\\$match: { $1 }", documentation: "Filters the documents to pass only matching documents." },
  { label: "$group", detail: "Group by expression", insertText: "\\$group: {\n  _id: $1,\n}", documentation: "Groups input documents by a specified expression." },
  { label: "$sort", detail: "Sort documents", insertText: "\\$sort: { $1: 1 }", documentation: "Reorders the document stream by a specified sort key." },
  { label: "$limit", detail: "Limit results", insertText: "\\$limit: $1", documentation: "Limits the number of documents." },
  { label: "$skip", detail: "Skip documents", insertText: "\\$skip: $1", documentation: "Skips a specified number of documents." },
  { label: "$project", detail: "Reshape documents", insertText: "\\$project: {\n  $1\n}", documentation: "Reshapes each document in the stream." },
  { label: "$unwind", detail: "Deconstruct array", insertText: '\\$unwind: "\\$$1"', documentation: "Deconstructs an array field from input documents." },
  { label: "$lookup", detail: "Join collections", insertText: '\\$lookup: {\n  from: "$1",\n  localField: "$2",\n  foreignField: "$3",\n  as: "$4"\n}', documentation: "Performs a left outer join to another collection." },
  { label: "$addFields", detail: "Add fields", insertText: "\\$addFields: {\n  $1\n}", documentation: "Adds new fields to documents." },
  { label: "$replaceRoot", detail: "Replace root", insertText: '\\$replaceRoot: { newRoot: "\\$$1" }', documentation: "Replaces the input document with the specified document." },
  { label: "$facet", detail: "Multi-faceted", insertText: "\\$facet: {\n  $1: []\n}", documentation: "Processes multiple aggregation pipelines within a single stage." },
  { label: "$bucket", detail: "Bucket", insertText: '\\$bucket: {\n  groupBy: "\\$$1",\n  boundaries: [$2],\n  default: "Other"\n}', documentation: "Categorizes incoming documents into groups." },
  { label: "$count", detail: "Count documents", insertText: '\\$count: "$1"', documentation: "Returns a count of documents at this stage." },
  { label: "$sample", detail: "Random sample", insertText: "\\$sample: { size: $1 }", documentation: "Randomly selects the specified number of documents." },
  { label: "$merge", detail: "Merge into collection", insertText: '\\$merge: { into: "$1" }', documentation: "Writes the results to a specified collection." },
  { label: "$out", detail: "Output to collection", insertText: '\\$out: "$1"', documentation: "Writes the results to a collection." },
];

const BSON_CONSTRUCTORS = [
  { label: "ObjectId", insertText: 'ObjectId("$1")', documentation: "Creates a new ObjectId." },
  { label: "ISODate", insertText: 'ISODate("$1")', documentation: "Creates a date object. Accepts ISO 8601 date string." },
  { label: "NumberLong", insertText: "NumberLong($1)", documentation: "Creates a 64-bit integer." },
  { label: "NumberInt", insertText: "NumberInt($1)", documentation: "Creates a 32-bit integer." },
  { label: "NumberDecimal", insertText: 'NumberDecimal("$1")', documentation: "Creates a 128-bit decimal." },
  { label: "UUID", insertText: 'UUID("$1")', documentation: "Creates a UUID (Binary subtype 4)." },
  { label: "Timestamp", insertText: "Timestamp($1, $2)", documentation: "Creates a Timestamp." },
];

export function registerCompletionProvider(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider("mongoShell", {
    triggerCharacters: [".", "$", "{", '"'],
    provideCompletionItems(
      model: editor.ITextModel,
      position: Position,
      _context: languages.CompletionContext,
      _token: CancellationToken,
    ): languages.ProviderResult<languages.CompletionList> {
      const lineContent = model.getLineContent(position.lineNumber);
      const lineUntilPosition = lineContent.substring(0, position.column - 1);

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // After "db." -> suggest collection methods or collection names
      if (/db\.\w*$/.test(lineUntilPosition) && !/db\.\w+\./.test(lineUntilPosition)) {
        return {
          suggestions: [
            ...["getCollectionNames", "getCollectionInfos", "stats", "adminCommand", "createCollection"].map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: name.includes("(") ? name : `${name}()`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              documentation: `db.${name}`,
            })),
          ],
        };
      }

      // After "db.collection." -> suggest CRUD methods
      if (/db\.\w+\.\w*$/.test(lineUntilPosition)) {
        return {
          suggestions: COLLECTION_METHODS.map((m) => ({
            label: m.label,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: m.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: m.detail,
            documentation: m.documentation,
            range,
          })),
        };
      }

      // Inside { } -> suggest operators starting with $
      if (lineUntilPosition.includes("{") && /\$\w*$/.test(lineUntilPosition)) {
        const dollarPos = lineUntilPosition.lastIndexOf("$");
        const operatorRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: dollarPos + 1,
          endColumn: position.column,
        };

        return {
          suggestions: QUERY_OPERATORS.map((op) => ({
            label: op.label,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: op.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: op.detail,
            documentation: op.documentation,
            range: operatorRange,
          })),
        };
      }

      // BSON constructors
      const suggestions: languages.CompletionItem[] = BSON_CONSTRUCTORS.map((bc) => ({
        label: bc.label,
        kind: monaco.languages.CompletionItemKind.Constructor,
        insertText: bc.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: bc.documentation,
        range,
      }));

      // Also suggest "db"
      suggestions.push({
        label: "db",
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: "db.",
        detail: "Database reference",
        documentation: "Reference to the current database",
        range,
      });

      return { suggestions };
    },
  });
}
