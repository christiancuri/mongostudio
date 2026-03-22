import { useTabStore } from "@/stores/tabStore";
import { dbCol } from "@/utils/mongo";

export function openEditDocumentTab(
  connectionId: string,
  database: string,
  collection: string,
  document: Record<string, unknown>,
  colorFlag?: string,
) {
  const store = useTabStore.getState();
  const idStr = formatDocId(document._id);

  const updateFields = Object.entries(document)
    .filter(([key]) => key !== "_id")
    .map(([key, value]) => `    ${key}: ${formatBsonValue(value)}`)
    .join(",\n");

  const content = `${dbCol(collection)}.updateOne(
  { _id: ${idStr} },
  { $set: {
${updateFields}
  } }
)`;

  store.addTab({
    id: crypto.randomUUID(),
    title: `Edit: ${idStr.slice(0, 20)}...`,
    type: "document",
    connectionId,
    database,
    collection,
    content,
    dirty: false,
    colorFlag,
  });
}

export function openInsertDocumentTab(
  connectionId: string,
  database: string,
  collection: string,
  colorFlag?: string,
) {
  const store = useTabStore.getState();
  const content = `${dbCol(collection)}.insertOne({

})`;

  store.addTab({
    id: crypto.randomUUID(),
    title: `Insert: ${collection}`,
    type: "document",
    connectionId,
    database,
    collection,
    content,
    dirty: false,
    colorFlag,
  });
}

export function openCloneDocumentTab(
  connectionId: string,
  database: string,
  collection: string,
  document: Record<string, unknown>,
  colorFlag?: string,
) {
  const store = useTabStore.getState();

  // Remove _id for clone
  const cloneDoc = { ...document };
  cloneDoc._id = undefined;

  const fields = Object.entries(cloneDoc)
    .map(([key, value]) => `  ${key}: ${formatBsonValue(value)}`)
    .join(",\n");

  const content = `${dbCol(collection)}.insertOne({
${fields}
})`;

  store.addTab({
    id: crypto.randomUUID(),
    title: `Clone: ${collection}`,
    type: "document",
    connectionId,
    database,
    collection,
    content,
    dirty: false,
    colorFlag,
  });
}

export function generateDeleteCommand(
  collection: string,
  document: Record<string, unknown>,
): string {
  const idStr = formatDocId(document._id);
  return `${dbCol(collection)}.deleteOne({ _id: ${idStr} })`;
}

function formatDocId(id: unknown): string {
  if (id === null || id === undefined) return "null";
  if (typeof id === "object" && id !== null) {
    const obj = id as Record<string, unknown>;
    if ("$oid" in obj) return `ObjectId("${obj.$oid}")`;
  }
  if (typeof id === "string") return `"${id}"`;
  return String(id);
}

function formatBsonValue(value: unknown, indent = 4): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    // BSON extended JSON types
    if ("$oid" in obj) return `ObjectId("${obj.$oid}")`;
    if ("$date" in obj) return `ISODate("${obj.$date}")`;
    if ("$numberLong" in obj) return `NumberLong("${obj.$numberLong}")`;
    if ("$numberDecimal" in obj) return `NumberDecimal("${obj.$numberDecimal}")`;
    if ("$regex" in obj) return `/${obj.$regex}/${obj.$options ?? ""}`;

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const spaces = " ".repeat(indent);
      const innerSpaces = " ".repeat(indent + 2);
      const items = value.map((v) => `${innerSpaces}${formatBsonValue(v, indent + 2)}`).join(",\n");
      return `[\n${items}\n${spaces}]`;
    }

    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    const spaces = " ".repeat(indent);
    const innerSpaces = " ".repeat(indent + 2);
    const fields = entries
      .map(([k, v]) => `${innerSpaces}${k}: ${formatBsonValue(v, indent + 2)}`)
      .join(",\n");
    return `{\n${fields}\n${spaces}}`;
  }

  return String(value);
}
