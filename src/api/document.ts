import { invoke } from "@tauri-apps/api/core";

export async function insertDocument(
  connectionId: string,
  database: string,
  collection: string,
  document: Record<string, unknown>,
): Promise<{ insertedId: string }> {
  return invoke("insert_document", { connectionId, database, collection, document });
}

export async function updateDocument(
  connectionId: string,
  database: string,
  collection: string,
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
): Promise<{ matchedCount: number; modifiedCount: number }> {
  return invoke("update_document", { connectionId, database, collection, filter, update });
}

export async function deleteDocument(
  connectionId: string,
  database: string,
  collection: string,
  filter: Record<string, unknown>,
): Promise<{ deletedCount: number }> {
  return invoke("delete_document", { connectionId, database, collection, filter });
}
