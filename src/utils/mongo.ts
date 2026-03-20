// Returns true if collection name needs db.getCollection("name") syntax
// (contains chars that aren't valid JS identifiers)
function needsGetCollection(name: string): boolean {
  return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

// Returns `db.name` or `db.getCollection("name")` depending on the collection name
export function dbCol(collection: string): string {
  if (needsGetCollection(collection)) {
    return `db.getCollection("${collection}")`;
  }
  return `db.${collection}`;
}
